/**
 * Backfill de RevenueEntry a partir dos negócios ganhos do Pipedrive.
 *
 * Uso no shell do Railway:
 *   node scripts/backfill-revenue.js
 *
 * Ou localmente com as variáveis do Railway:
 *   DATABASE_URL=postgres://... PIPEDRIVE_API_TOKEN=feff... PIPEDRIVE_DOMAIN=autoforce2 node scripts/backfill-revenue.js
 */

'use strict';

// ---------------------------------------------------------------------------
// Field keys & option maps (copiados de pipedrive.service.ts)
// ---------------------------------------------------------------------------

const F = {
  CANAL_ORIGEM:     '9459f9b49acca8552e69c0ee0898f751b05b4fe6',
  SETUP_VALUE:      '4a5f006a09009d88b1eedfe13222b267c1507f8a',
  PRODUTO_VENDA:    '1d44a1c1a505d689fa71d5e06b7f813f6a7dffff',
  PORQUE_COMPROU:   '3c73185140050c4a7fe0e5aed7fbc07380ca2e16',
  FORNECEDOR_ATUAL: 'd3eb5536e0e9481894b2bd7829a23b07421e33cc',
  VENDEDOR:         'd0c46ae25c4019c285fbcecdf6a36f12f3aefcc0',
  CONTRACT_LINK:    '6d8d5c688ce56ff0262d760ed1cf35fdbbcac879',
};

const OPT_CANAL_INBOUND = 66;

const MAP_PRODUTO = { 97:'Showroom Digital',98:'Landing Page',99:'Portal de Grupo',100:'Portal de Consorcio',101:'Portal de Assinatura',102:'Portal de Seminovos',103:'Autopilot',104:'Autobot',105:'NitroAds',106:'CRM Autopilot',107:'IA Autopilot',108:'Campanha Autopilot',109:'Automação Autopilot',154:'360',155:'Portal de Blindagem',156:'Showroom 2.0',194:'Setup' };
const MAP_PORQUE = { 164:'Insatisfação com Fornecedor Atual',165:'Referência da Autoforce',166:'Precificação Atrativa',167:'Exigência da Montadora',168:'Solução inexistente no fornecedor atual',169:'Complicações com desenvolvimento próprio',170:'Encantamento Comercial',171:'Atende dor Prioritária' };
const MAP_FORNECEDOR = { 127:'DealerSpace',128:'Syonet',129:'AlpesOne',130:'Motorleads',131:'Microwork',132:'Autocerto',133:'Autoveículo',134:'Agência Lua4',135:'Followize',136:'Salesforce',137:'Autoconf',140:'Outros',158:'Operação Nova',159:'Desenvolvimento Próprio',160:'Agência (diversas)',161:'Webmotors',162:'Revenda Mais',217:'Autoforce' };
const MAP_VENDEDOR = { 81:'Aline Dantas',84:'Mikaely Dias',85:'Pedro Paiva',86:'Tiago Fernandes',117:'Darlan Barros',141:'Time Cuidar',148:'Luis Antonio',149:'Angelina Rodrigues',150:'Iluama Cavalcanti',151:'Marco Veppo',152:'Mayara Machado',197:'Deogenes Brito',203:'Jonathan Rodrigues',204:'Rebeca Nogueira' };

const MAP_ORIGEM = { 66:'Inbound',69:'Outbound',70:'Parceria',96:'Indicação',139:'Clientes CS/Upsell' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSet(raw, map) {
  if (!raw) return [];
  const ids = Array.isArray(raw) ? raw : String(raw).split(',');
  return ids.map(id => map[Number(String(id).trim())] || String(id).trim()).filter(Boolean);
}

function resolveEnum(raw, map) {
  if (raw == null) return null;
  return map[Number(raw)] || null;
}

function extractSetup(raw) {
  if (!raw) return 0;
  if (typeof raw === 'object' && raw !== null && 'value' in raw) return Number(raw.value) || 0;
  return Number(raw) || 0;
}

function sourceToOrigin(src) {
  if (!src) return 'Outros';
  const s = src.toLowerCase();
  if (s.includes('google'))                                        return 'Google Ads';
  if (s.includes('facebook') || s.includes('instagram') || s.includes('meta')) return 'Facebook/Meta';
  if (s.includes('indica') || s.includes('whatsapp') || s.includes('email'))   return 'Indicação';
  if (s === 'organico' || s === 'direto')                          return 'Organico';
  return 'Outros';
}

// ---------------------------------------------------------------------------
// Pipedrive API
// ---------------------------------------------------------------------------

async function pipedriveFetch(path, token, domain, params = {}) {
  const url = new URL(`https://${domain}.pipedrive.com/api/v1${path}`);
  url.searchParams.set('api_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Pipedrive ${path} → HTTP ${res.status}`);
  return res.json();
}

async function fetchAllDeals(token, domain, pipelineId) {
  const all = [];
  let start = 0;
  while (true) {
    const json = await pipedriveFetch(`/pipelines/${pipelineId}/deals`, token, domain, { start, limit: 100, status: 'won' });
    if (!json.success || !json.data) break;
    all.push(...json.data);
    const p = json.additional_data?.pagination;
    if (!p?.more_items_in_collection) break;
    start = p.next_start ?? start + 100;
  }
  return all;
}

// ---------------------------------------------------------------------------
// DB helpers (using @prisma/client directly)
// ---------------------------------------------------------------------------

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const token  = process.env.PIPEDRIVE_API_TOKEN;
  const domain = process.env.PIPEDRIVE_DOMAIN;

  if (!token || !domain) {
    console.error('❌ PIPEDRIVE_API_TOKEN e/ou PIPEDRIVE_DOMAIN não configurados.');
    process.exit(1);
  }

  console.log('🔄 Buscando negócios ganhos do Pipedrive (pipelines 2 e 5)...');
  const [deals2, deals5] = await Promise.all([
    fetchAllDeals(token, domain, 2),
    fetchAllDeals(token, domain, 5),
  ]);
  const allDeals = [...deals2, ...deals5];
  console.log(`   → ${allDeals.length} negócios ganhos encontrados`);

  const inboundDeals = allDeals.filter(d => d[F.CANAL_ORIGEM] === OPT_CANAL_INBOUND);
  console.log(`   → ${inboundDeals.length} com Canal de Origem = Inbound (66)\n`);

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (const deal of inboundDeals) {
    const dealId = String(deal.id);

    // Resolve email from person_id.email or person_email
    const emails = deal.person_email ?? deal.person_id?.email ?? [];
    const email  = emails.find(e => e.primary)?.value || emails[0]?.value || null;
    const personId = deal.person_id?.value ? String(deal.person_id.value) : null;

    // Find matching lead
    let lead = email ? await prisma.lead.findUnique({ where: { email: email.toLowerCase().trim() } }) : null;
    if (!lead && personId) lead = await prisma.lead.findFirst({ where: { pipedrivePersonId: personId } });

    if (!lead) {
      console.log(`   ⚠️  Deal #${dealId} "${deal.title}" — sem lead correspondente, ignorando`);
      skipped++;
      continue;
    }

    const setupVal   = extractSetup(deal[F.SETUP_VALUE]);
    const produtos   = resolveSet(deal[F.PRODUTO_VENDA], MAP_PRODUTO);
    const porqueComp = resolveSet(deal[F.PORQUE_COMPROU], MAP_PORQUE);
    const fornecedor = resolveSet(deal[F.FORNECEDOR_ATUAL], MAP_FORNECEDOR);
    const vendedor   = resolveEnum(deal[F.VENDEDOR], MAP_VENDEDOR);
    const contrato   = deal[F.CONTRACT_LINK] ?? null;
    const dealUrl    = `https://${domain}.pipedrive.com/deal/${dealId}`;
    const biz        = lead.company || deal.person_name || lead.name || lead.email;
    const orig       = sourceToOrigin(lead.firstSource);
    const wonAt      = new Date(deal.won_time || deal.close_time || deal.add_time);

    try {
      const existing = await prisma.revenueEntry.findUnique({ where: { id: `pipedrive-${dealId}` } });

      await prisma.revenueEntry.upsert({
        where: { id: `pipedrive-${dealId}` },
        update: {
          mrrValue:        deal.value,
          setupValue:      setupVal,
          businessName:    biz,
          origin:          orig,
          product:         produtos,
          closedBy:        vendedor,
          whyBought:       porqueComp,
          currentSupplier: fornecedor,
          contractLink:    contrato,
          dealUrl,
          updatedAt:       new Date(),
        },
        create: {
          id:              `pipedrive-${dealId}`,
          leadEmail:       lead.email,
          businessName:    biz,
          date:            wonAt,
          setupValue:      setupVal,
          mrrValue:        deal.value,
          origin:          orig,
          originType:      'INBOUND',
          product:         produtos,
          closedBy:        vendedor,
          whyBought:       porqueComp,
          currentSupplier: fornecedor,
          contractLink:    contrato,
          dealUrl,
        },
      });

      if (existing) {
        updated++;
        console.log(`   ✅ Atualizado: #${dealId} "${deal.title}" | MRR=${deal.value} Setup=${setupVal} Produtos=${produtos.join(', ') || '-'} Vendedor=${vendedor || '-'}`);
      } else {
        created++;
        console.log(`   ➕ Criado:     #${dealId} "${deal.title}" | MRR=${deal.value} Setup=${setupVal} Produtos=${produtos.join(', ') || '-'} Vendedor=${vendedor || '-'}`);
      }
    } catch (err) {
      errors++;
      console.error(`   ❌ Erro no deal #${dealId}: ${err.message}`);
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   Criados:    ${created}`);
  console.log(`   Atualizados: ${updated}`);
  console.log(`   Sem lead:   ${skipped}`);
  console.log(`   Erros:      ${errors}`);
  console.log(`   Total inbound: ${inboundDeals.length}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
