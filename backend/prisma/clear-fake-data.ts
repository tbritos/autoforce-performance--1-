import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando dados fake do banco de dados...');

  // Limpar todos os dados fake
  const deletedLeads = await prisma.dailyLead.deleteMany({});
  console.log(`✅ ${deletedLeads.count} leads removidos`);

  const deletedRevenue = await prisma.revenueEntry.deleteMany({});
  console.log(`✅ ${deletedRevenue.count} receitas removidas`);

  const deletedOKRs = await prisma.oKR.deleteMany({});
  console.log(`✅ ${deletedOKRs.count} OKRs removidos`);

  const deletedTeam = await prisma.teamMember.deleteMany({});
  console.log(`✅ ${deletedTeam.count} membros da equipe removidos`);

  const deletedPages = await prisma.landingPage.deleteMany({});
  console.log(`✅ ${deletedPages.count} landing pages removidas`);

  console.log('✅ Banco de dados limpo! Agora você pode adicionar dados reais.');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao limpar dados:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
