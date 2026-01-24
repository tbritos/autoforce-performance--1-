import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpar dados existentes (opcional - comentar se quiser manter dados)
  // await prisma.dailyLead.deleteMany();
  // await prisma.revenueEntry.deleteMany();
  // await prisma.oKR.deleteMany();
  // await prisma.teamMember.deleteMany();
  // await prisma.landingPage.deleteMany();

  // 1. Daily Leads - Últimos 30 dias
  console.log('📊 Criando dados de leads...');
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const mql = Math.floor(Math.random() * 50) + 10;
    const sql = Math.floor(mql * 0.6);
    const sales = Math.floor(sql * 0.2);
    const conversionRate = mql > 0 ? (sales / mql) * 100 : 0;

    await prisma.dailyLead.upsert({
      where: { date },
      update: {
        mql,
        sql,
        sales,
        conversionRate,
      },
      create: {
        date,
        mql,
        sql,
        sales,
        conversionRate,
      },
    });
  }

  // 2. Revenue Entries - Últimos 2 meses
  console.log('💰 Criando dados de receita...');
  const revenueData = [
    { businessName: 'Grupo Sinal', setupValue: 5000, mrrValue: 1200, origin: 'Google Ads', product: 'Autoforce Site' },
    { businessName: 'Concessionária Elite', setupValue: 3500, mrrValue: 800, origin: 'Indicação', product: 'Autoforce MKT' },
    { businessName: 'AutoCenter Premium', setupValue: 7500, mrrValue: 1500, origin: 'Google Ads', product: 'Autoforce Site' },
    { businessName: 'Mega Motors', setupValue: 4200, mrrValue: 950, origin: 'Facebook Ads', product: 'Autoforce MKT' },
  ];

  for (let i = 0; i < revenueData.length; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (i * 7));
    
    await prisma.revenueEntry.create({
      data: {
        date,
        ...revenueData[i],
      },
    });
  }

  // 3. OKRs
  console.log('🎯 Criando OKRs...');
  await prisma.oKR.upsert({
    where: { id: 'okr-1' },
    update: {},
    create: {
      id: 'okr-1',
      quarter: 'Q1 2026',
      objective: 'Aumentar a penetração de mercado em Concessionárias Honda',
      progress: 45,
      keyResults: [
        { id: 'kr1', title: 'Fechar 10 novos contratos com grupos Honda', currentValue: 4, targetValue: 10, unit: '#' },
        { id: 'kr2', title: 'Aumentar leads qualificados desse segmento em 20%', currentValue: 8, targetValue: 20, unit: '%' },
      ],
    },
  });

  await prisma.oKR.upsert({
    where: { id: 'okr-2' },
    update: {},
    create: {
      id: 'okr-2',
      quarter: 'Q2 2026',
      objective: 'Lançar nova feature de IA Generativa',
      progress: 0,
      keyResults: [
        { id: 'kr3', title: 'Finalizar desenvolvimento do Beta', currentValue: 0, targetValue: 100, unit: '%' },
        { id: 'kr4', title: 'Conseguir 50 usuários beta testando', currentValue: 0, targetValue: 50, unit: '#' },
      ],
    },
  });

  // 4. Team Members
  console.log('👥 Criando membros da equipe...');
  const teamMembers = [
    {
      name: 'Carlos Silva',
      role: 'Closer',
      avatar: 'https://ui-avatars.com/api/?name=Carlos+Silva&background=1440FF&color=fff',
      status: 'online',
      lastActive: 'Agora',
      leadsGenerated: 450,
      salesClosed: 28,
      goalProgress: 92,
    },
    {
      name: 'Fernanda Lima',
      role: 'SDR',
      avatar: 'https://ui-avatars.com/api/?name=Fernanda+Lima&background=FFA814&color=000',
      status: 'busy',
      lastActive: '15min atrás',
      leadsGenerated: 890,
      salesClosed: 12,
      goalProgress: 110,
    },
    {
      name: 'Roberto Almeida',
      role: 'Marketing',
      avatar: 'https://ui-avatars.com/api/?name=Roberto+Almeida&background=00C851&color=fff',
      status: 'offline',
      lastActive: '1h atrás',
      leadsGenerated: 1200,
      salesClosed: 5,
      goalProgress: 85,
    },
    {
      name: 'Juliana Costa',
      role: 'Closer',
      avatar: 'https://ui-avatars.com/api/?name=Juliana+Costa&background=1440FF&color=fff',
      status: 'online',
      lastActive: 'Agora',
      leadsGenerated: 380,
      salesClosed: 32,
      goalProgress: 105,
    },
  ];

  for (const member of teamMembers) {
    await prisma.teamMember.upsert({
      where: { id: `team-${member.name.toLowerCase().replace(' ', '-')}` },
      update: member,
      create: {
        id: `team-${member.name.toLowerCase().replace(' ', '-')}`,
        ...member,
      },
    });
  }

  // 5. Landing Pages
  console.log('📄 Criando landing pages...');
  const landingPages = [
    {
      name: 'Oferta SUV 2025',
      path: '/oferta-suv-2025',
      views: 15420,
      users: 12050,
      conversions: 850,
      conversionRate: 7.05,
      avgEngagementTime: '1m 32s',
      source: 'google_analytics',
    },
    {
      name: 'Feirão Seminovos',
      path: '/lp/feirao-seminovos',
      views: 10200,
      users: 8400,
      conversions: 520,
      conversionRate: 6.19,
      avgEngagementTime: '0m 58s',
      source: 'google_analytics',
    },
    {
      name: 'Agendamento Revisão',
      path: '/servicos/agendamento',
      views: 4500,
      users: 3200,
      conversions: 480,
      conversionRate: 15.00,
      avgEngagementTime: '2m 15s',
      source: 'google_analytics',
    },
    {
      name: 'Consórcio Nacional',
      path: '/lp-consorcio',
      views: 6800,
      users: 5100,
      conversions: 150,
      conversionRate: 2.94,
      avgEngagementTime: '0m 45s',
      source: 'google_analytics',
    },
    {
      name: 'Pré-venda Elétrico',
      path: '/lancamento/eletrico',
      views: 22000,
      users: 15000,
      conversions: 2200,
      conversionRate: 14.6,
      avgEngagementTime: '3m 10s',
      source: 'google_analytics',
    },
  ];

  for (const page of landingPages) {
    await prisma.landingPage.upsert({
      where: { id: `lp-${page.path.replace(/\//g, '-')}` },
      update: page,
      create: {
        id: `lp-${page.path.replace(/\//g, '-')}`,
        ...page,
      },
    });
  }

  console.log('✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
