import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: {
      firstSource: 'importacao_csv',
      NOT: { tags: { has: 'importacao' } },
      deletedAt: null,
    },
    select: { email: true },
  });

  console.log(`${leads.length} leads para atualizar...`);

  let updated = 0;
  for (const lead of leads) {
    await prisma.lead.update({
      where: { email: lead.email },
      data: { tags: { push: 'importacao' } },
    });
    updated++;
    if (updated % 100 === 0) console.log(`  ${updated}/${leads.length}`);
  }

  console.log(`Pronto! ${updated} leads receberam a tag "importacao".`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
