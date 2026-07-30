import { prisma } from '../src/config/database';
import { planHistoricalLaraRepair } from '../src/services/lara-crm-repair';
import { setMarketingStage } from '../src/services/lead-marketing-stage.service';

const applyChanges = process.argv.includes('--apply');

async function main(): Promise<void> {
  const candidates = await prisma.lead.findMany({
    where: {
      OR: [
        { aiScore: null, researchIcpSignal: { in: ['qualified', 'nurture', 'disqualified'] } },
        { aiHandoff: true },
        { tags: { hasSome: ['link_agendamento_enviado', 'reuniao_agendada', 'transferido-para-humano'] } },
        {
          marketingStage: 'QUALIFICACAO',
          marketingStageSource: 'ai',
          researchIcpSignal: 'nurture',
        },
      ],
    },
    select: {
      id: true,
      email: true,
      marketingStage: true,
      marketingStageSource: true,
      marketingStageChangedAt: true,
      researchedAt: true,
      researchIcpSignal: true,
      aiScore: true,
      tags: true,
      aiHandoff: true,
    },
    orderBy: { firstSeenAt: 'asc' },
  });

  const repairs = candidates
    .map(lead => ({ lead, plan: planHistoricalLaraRepair(lead) }))
    .filter(({ plan }) => plan.stage !== undefined || plan.aiScore !== undefined);

  console.log(`[LaraRepair] modo=${applyChanges ? 'APLICAR' : 'PREVIA'} candidatos=${candidates.length} reparos=${repairs.length}`);
  for (const { lead, plan } of repairs) {
    console.log(
      `[LaraRepair] ${lead.email} stage=${lead.marketingStage}->${plan.stage ?? 'sem mudanca'} `
      + `aiScore=${lead.aiScore ?? 'null'}->${plan.aiScore ?? 'sem mudanca'} `
      + `motivos=${plan.reasons.join('; ')}`,
    );
  }

  if (!applyChanges) {
    console.log('[LaraRepair] nenhuma alteracao aplicada. Execute novamente com --apply depois de revisar a previa.');
    return;
  }

  let updated = 0;
  for (const { lead, plan } of repairs) {
    if (plan.stage) {
      await setMarketingStage(
        lead.email,
        plan.stage,
        'system',
        undefined,
        `Reparo historico CRM Lara: ${plan.reasons.join('; ')}`,
      );
    }
    if (plan.aiScore !== undefined) {
      await prisma.lead.updateMany({
        where: { id: lead.id, aiScore: null },
        data: { aiScore: plan.aiScore },
      });
    }
    updated++;
  }

  console.log(`[LaraRepair] reparo concluido: ${updated} leads processados`);
}

main()
  .catch(error => {
    console.error('[LaraRepair] falha:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
