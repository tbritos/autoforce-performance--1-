/**
 * One-time migration: WebhookLead (RdLead) → Lead + LeadConversion
 *
 * Run after applying migration 20260523100000_lead_foundation:
 *   npx ts-node prisma/migrate-webhook-leads.ts
 *
 * Safe to re-run: upsert by email + unique constraint on
 * [externalId, source] prevents duplicate records.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const normalizeEmail = (email: string): string => email.toLowerCase().trim();

async function main() {
  const total = await prisma.webhookLead.count();
  console.log(`Found ${total} WebhookLead records to migrate.\n`);

  let migrated = 0;
  let skippedNoEmail = 0;
  let errors = 0;

  // Process in batches to avoid memory issues on large datasets
  const batchSize = 100;
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.webhookLead.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const wl of batch) {
      if (!wl.email) {
        skippedNoEmail++;
        continue;
      }

      const email = normalizeEmail(wl.email);

      try {
        await prisma.$transaction(async (tx) => {
          // Step 1: upsert Lead — fill-blank strategy
          const existing = await tx.lead.findUnique({ where: { email } });

          if (!existing) {
            await tx.lead.create({
              data: {
                email,
                name: wl.name || null,
                phone: wl.phone || null,
                company: wl.company || null,
                firstSource: 'rdstation',
                firstSeenAt: wl.lastConversionDate || wl.createdAt,
                lastSeenAt: wl.lastConversionDate || wl.updatedAt,
              },
            });
          } else {
            const update: Record<string, any> = { lastSeenAt: wl.lastConversionDate || wl.updatedAt };
            if (!existing.name && wl.name) update.name = wl.name;
            if (!existing.phone && wl.phone) update.phone = wl.phone;
            if (!existing.company && wl.company) update.company = wl.company;
            await tx.lead.update({ where: { email }, data: update });
          }

          // Step 2: record conversion (idempotent via unique constraint)
          const existing_conversion = wl.externalId
            ? await tx.leadConversion.findUnique({
                where: {
                  externalId_source: {
                    externalId: wl.externalId,
                    source: wl.source,
                  },
                },
              })
            : null;

          if (!existing_conversion) {
            await tx.leadConversion.create({
              data: {
                leadEmail: email,
                source: wl.source,
                externalId: wl.externalId,
                formName: wl.conversionName || null,
                rawData: {
                  externalId: wl.externalId,
                  name: wl.name,
                  email: wl.email,
                  phone: wl.phone,
                  company: wl.company,
                  conversionIdentifier: wl.conversionIdentifier,
                  conversionName: wl.conversionName,
                  source: wl.source,
                  migratedFromRdLead: true,
                },
                convertedAt: wl.lastConversionDate || wl.createdAt,
              },
            });
          }
        });

        migrated++;
      } catch (err) {
        errors++;
        console.error(`  ERROR on ${email}: ${err instanceof Error ? err.message : err}`);
      }
    }

    const pct = Math.round(((migrated + skippedNoEmail + errors) / total) * 100);
    process.stdout.write(`  Progress: ${migrated + skippedNoEmail + errors}/${total} (${pct}%)\r`);
  }

  console.log('\n');
  console.log('=== Migration complete ===');
  console.log(`  Migrated:        ${migrated}`);
  console.log(`  Skipped (no email): ${skippedNoEmail}`);
  console.log(`  Errors:          ${errors}`);

  // Validation: compare counts
  const leadCount = await prisma.lead.count();
  const conversionCount = await prisma.leadConversion.count({ where: { source: 'rdstation' } });

  console.log('\n=== Validation ===');
  console.log(`  WebhookLead total:        ${total}`);
  console.log(`  WebhookLead with email:   ${total - skippedNoEmail}`);
  console.log(`  Lead records created:     ${leadCount} (total, may include pre-existing)`);
  console.log(`  LeadConversion (rdstation): ${conversionCount}`);

  if (errors > 0) {
    console.log('\n⚠️  Some records failed. Re-run the script to retry them.');
    process.exit(1);
  } else {
    console.log('\n✅ All records migrated successfully.');
  }
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
