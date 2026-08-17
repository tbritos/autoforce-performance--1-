import assert from 'node:assert/strict';
import { prisma } from '../src/config/database';
import { AutomationJourneysService } from '../src/services/automation-journeys.service';

async function main() {
  const suffix = Date.now().toString();
  const tag = `qa-monitor-${suffix}`;
  const emails = {
    free: `${tag}-free@example.com`,
    busy: `${tag}-busy@example.com`,
    waiting: `${tag}-waiting@example.com`,
    completed: `${tag}-completed@example.com`,
    exited: `${tag}-exited@example.com`,
  };
  const createdJourneyIds: string[] = [];
  const createdExecutionIds: string[] = [];

  try {
    await prisma.lead.createMany({
      data: [
        { email: emails.free, name: 'QA Livre', tags: [tag], phone: '11999990001' },
        { email: emails.busy, name: 'QA Ocupado', tags: [tag], phone: '11999990002' },
        { email: emails.waiting, name: 'QA Aguardando', tags: [tag], phone: '11999990003' },
        { email: emails.completed, name: 'QA Concluído', tags: [tag], phone: '11999990004' },
        { email: emails.exited, name: 'QA Saída MQL', tags: [tag], phone: '11999990005', status: 'MQL' },
      ],
    });

    const segment = await prisma.segment.create({
      data: {
        name: `[QA Monitor] ${suffix}`,
        rules: { logic: 'AND', conditions: [{ id: 'qa-tag', field: 'tags', operator: 'contains_tag', value: tag }] },
      },
    });
    const nodes = [
      { id: 'trigger', type: 'trigger', label: 'Entrada', x: 0, y: 0, config: { event: 'segment_entered', eventValue: segment.id } },
      { id: 'email-1', type: 'send_email', label: 'E-mail', x: 200, y: 0, config: { templateName: 'QA E-mail 1' } },
      { id: 'wait-1', type: 'wait', label: 'Espera', x: 400, y: 0, config: { amount: '3', unit: 'days' } },
      { id: 'whatsapp-1', type: 'whatsapp_message', label: 'WhatsApp', x: 600, y: 0, config: { templateName: 'qa_whatsapp_1' } },
    ];
    const edges = [
      { id: 'e1', source: 'trigger', target: 'email-1' },
      { id: 'e2', source: 'email-1', target: 'wait-1' },
      { id: 'e3', source: 'wait-1', target: 'whatsapp-1' },
    ];
    const target = await prisma.automationJourney.create({
      data: {
        name: `[QA Monitor] Target ${suffix}`,
        status: 'DRAFT',
        isActive: false,
        automationType: 'NURTURE',
        entryMode: 'AUDIENCE',
        nodes,
        edges,
        exitConditions: { logic: 'OR', conditions: [{ field: 'status', operator: '=', value: 'MQL' }] },
      },
    });
    const other = await prisma.automationJourney.create({
      data: {
        name: `[QA Monitor] Other ${suffix}`,
        status: 'ACTIVE',
        isActive: true,
        automationType: 'NURTURE',
        nodes: [{ id: 'other-trigger', type: 'trigger', label: 'Entrada', x: 0, y: 0, config: { event: 'lead_created' } }],
        edges: [],
      },
    });
    createdJourneyIds.push(target.id, other.id);

    const busyExecution = await prisma.automationExecution.create({
      data: {
        journeyId: other.id, leadEmail: emails.busy, status: 'waiting', currentNodeId: 'other-trigger',
        automationTypeSnapshot: 'NURTURE', prioritySnapshot: 75,
      },
    });
    const waitingExecution = await prisma.automationExecution.create({
      data: {
        journeyId: target.id, leadEmail: emails.waiting, status: 'waiting', currentNodeId: 'wait-1',
        automationTypeSnapshot: 'NURTURE', prioritySnapshot: 50,
        log: [
          { nodeId: 'email-1', nodeType: 'send_email', status: 'ok', ts: new Date().toISOString() },
          { nodeId: 'wait-1', nodeType: 'wait', status: 'ok', ts: new Date().toISOString() },
        ],
      },
    });
    const completedExecution = await prisma.automationExecution.create({
      data: {
        journeyId: target.id, leadEmail: emails.completed, status: 'completed', currentNodeId: 'whatsapp-1',
        completedAt: new Date(), automationTypeSnapshot: 'NURTURE', prioritySnapshot: 50,
        log: [
          { nodeId: 'email-1', nodeType: 'send_email', status: 'ok', ts: new Date().toISOString() },
          { nodeId: 'wait-1', nodeType: 'wait', status: 'ok', ts: new Date().toISOString() },
          { nodeId: 'whatsapp-1', nodeType: 'whatsapp_message', status: 'ok', ts: new Date().toISOString() },
        ],
      },
    });
    createdExecutionIds.push(busyExecution.id, waitingExecution.id, completedExecution.id);

    await prisma.emailSent.createMany({
      data: [
        {
          leadEmail: emails.waiting, toEmail: emails.waiting, subject: 'QA 1', automationExecutionId: waitingExecution.id,
          automationNodeId: 'email-1', deliveredAt: new Date(), openedAt: new Date(), clickedAt: new Date(),
        },
        {
          leadEmail: emails.completed, toEmail: emails.completed, subject: 'QA 1', automationExecutionId: completedExecution.id,
          automationNodeId: 'email-1', bouncedAt: new Date(),
        },
      ],
    });
    const sentAt = new Date(Date.now() - 60_000);
    await prisma.whatsAppMessage.createMany({
      data: [
        {
          leadEmail: emails.waiting, phone: '5511999990003', direction: 'outbound', type: 'template', status: 'read',
          templateName: 'qa_whatsapp_1', automationJourneyId: target.id, automationExecutionId: waitingExecution.id,
          sentAt, deliveredAt: sentAt, readAt: new Date(),
        },
        {
          leadEmail: emails.completed, phone: '5511999990004', direction: 'outbound', type: 'template', status: 'failed',
          templateName: 'qa_whatsapp_1', automationJourneyId: target.id, automationExecutionId: completedExecution.id,
          failedAt: new Date(),
        },
        {
          leadEmail: emails.waiting, phone: '5511999990003', direction: 'inbound', type: 'text', status: 'received',
          receivedAt: new Date(), createdAt: new Date(),
        },
      ],
    });

    const stats = await AutomationJourneysService.getExecutionStats(target.id);
    assert.deepEqual(stats.audience, {
      segmentTotal: 5,
      eligible: 4,
      excluded: 1,
      freeNow: 2,
      inOtherFlows: 1,
      inThisFlow: 1,
      queuedForThisFlow: 0,
    });
    assert.equal(stats.email.sentPeople, 2);
    assert.equal(stats.email.deliveredPeople, 1);
    assert.equal(stats.email.openedPeople, 1);
    assert.equal(stats.email.clickedPeople, 1);
    assert.equal(stats.email.bouncedPeople, 1);
    assert.equal(stats.whatsapp.sentPeople, 1);
    assert.equal(stats.whatsapp.deliveredPeople, 1);
    assert.equal(stats.whatsapp.readPeople, 1);
    assert.equal(stats.whatsapp.failedPeople, 1);
    assert.equal(stats.whatsapp.respondedPeople, 1);
    assert.equal(stats.stages.find(stage => stage.nodeId === 'wait-1')?.current, 1);

    console.log(JSON.stringify({ ok: true, journeyId: target.id, stats }, null, 2));
  } finally {
    await prisma.whatsAppMessage.deleteMany({ where: { leadEmail: { in: Object.values(emails) } } });
    await prisma.emailSent.deleteMany({ where: { leadEmail: { in: Object.values(emails) } } });
    if (createdExecutionIds.length) await prisma.automationExecution.deleteMany({ where: { id: { in: createdExecutionIds } } });
    if (createdJourneyIds.length) await prisma.automationJourney.deleteMany({ where: { id: { in: createdJourneyIds } } });
    await prisma.segment.deleteMany({ where: { name: { startsWith: `[QA Monitor] ${suffix}` } } });
    await prisma.lead.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
