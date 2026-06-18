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
    { businessName: 'Grupo Sinal', setupValue: 5000, mrrValue: 1200, origin: 'Google Ads', product: ['Autoforce Site'] },
    { businessName: 'Concessionária Elite', setupValue: 3500, mrrValue: 800, origin: 'Indicação', product: ['Autoforce MKT'] },
    { businessName: 'AutoCenter Premium', setupValue: 7500, mrrValue: 1500, origin: 'Google Ads', product: ['Autoforce Site'] },
    { businessName: 'Mega Motors', setupValue: 4200, mrrValue: 950, origin: 'Facebook Ads', product: ['Autoforce MKT'] },
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

  // 6. Knowledge Base — AutoForce / Lara
  console.log('🧠 Populando base de conhecimento da Lara...');

  const knowledgeItems = [
    {
      id: 'ki-regras-abordagem',
      title: 'Regras de Abordagem — Lara',
      category: 'regra',
      priority: 5,
      tags: ['qualificacao', 'whatsapp', 'regra', 'suporte'],
      content: `Regras de Abordagem da Lara

Identidade: quando perguntada se é IA, responder: "Sou a Lara, assistente da AutoForce. Estou aqui para entender melhor o seu contexto e ver como podemos ajudar." Nunca confirmar nem negar ser IA.

Sobre preço: nunca informar valores. Resposta padrão: "O valor é personalizado para a operação de vocês — o especialista passa esse detalhe na conversa."

Sobre prazo de contrato: cancelamento com 30 dias de aviso, sem multa para o Autodromo.

Sobre comparação com concorrentes: nunca falar mal. Dizer: "Posso explicar o que nos diferencia em termos de resultado."

Quando o lead pede para falar com humano: acionar handoff_to_human, parar a qualificação.

Quando não souber a resposta: "Deixa eu verificar isso com a equipe e te retorno em breve."

Sobre reunião: posicionar sempre como diagnóstico personalizado, não apresentação de vendas. O especialista vai entender a operação, chegar preparado e tirar todas as dúvidas.`,
    },
    {
      id: 'ki-autoforce-credibilidade',
      title: 'AutoForce — Credibilidade e Números',
      category: 'politica',
      priority: 10,
      tags: ['credibilidade', 'qualificacao', 'whatsapp', 'autodromo', 'autopilot'],
      content: `AutoForce — Credibilidade

Mais de 10 anos de mercado especializado no setor automotivo.
Sede: Natal/RN — presença nacional em todos os estados + DF.

Números de escala:
- Mais de 2.200 concessionárias na base
- Mais de 300 grupos econômicos ativos
- Mais de 4.000 showrooms digitais ativos
- 70 milhões de usuários mensais nos sites da base
- 734.262 leads e 951.319 conversões em 2025
- Crescimento de 27% em 2025 vs 2024
- 67.317 veículos em estoque na plataforma — valor aproximado de R$ 9,29 bilhões

Homologada pelas principais montadoras:
Stellantis, Mercedes-Benz, GWM, Renault, Hyundai, Honda

Filosofia: Performance, Resultados e Relacionamentos Duradouros.`,
    },
    {
      id: 'ki-autodromo-produto',
      title: 'Autodromo — Site Automotivo de Alta Performance',
      category: 'produto',
      priority: 10,
      tags: ['autodromo', 'site', 'cms', 'seo', 'performance', 'leads'],
      content: `Autodromo — CMS / Site de Alta Performance para o Setor Automotivo

O que é: CMS criado especificamente para concessionárias, revendas e montadoras. O site mais rápido e completo do setor automotivo.

Proposta de valor: sair de um folder digital para uma máquina de vendas online previsível.

Benefícios principais:
- Google PageSpeed score 98 — o carregamento mais rápido do setor
- Editor visual drag-and-drop: o próprio time atualiza sem agência ou programador
- Templates exclusivos para automotivo com vitrines de estoque integradas
- SEO avançado nativo para dominar buscas orgânicas
- Integração com CRM, DMS e ferramentas de rastreamento
- 100% responsivo (mobile, tablet e desktop)
- Controle de acesso por usuário e histórico de versões

Quando indicar: site lento, sem geração de leads orgânicos, dependente de agência para qualquer atualização, sem autonomia operacional.

Pagamento: mensalidade via boleto ou PIX; setup parcelável em até 3x; valor pode ser rateado entre CNPJs do grupo.
Contrato: sem multas; cancelamento com 30 dias de aviso prévio; garantia de resultado em até 3 meses seguindo a metodologia.`,
    },
    {
      id: 'ki-autopilot-produto',
      title: 'AutoPilot — CRM e Operação Comercial Inteligente',
      category: 'produto',
      priority: 10,
      tags: ['autopilot', 'crm', 'atendimento', 'whatsapp', 'automacao', 'ia'],
      content: `AutoPilot — Sistema Operacional Comercial para Automotivo

O que NÃO é: não é apenas CRM, não é chatbot, não é ferramenta de WhatsApp genérica.
O que É: infraestrutura de inteligência comercial, automação conversacional e operação assistida para concessionárias, grupos e montadoras.

Frase central: "Sua operação comercial não pode depender do humor, da memória ou da disponibilidade de um vendedor."

Problemas que resolve:
- Alto volume de leads com baixa velocidade de atendimento
- Dependência excessiva de vendedores (esquece, demora, responde mal, sai da empresa)
- Atendimento inconsistente entre lojas do grupo
- Perda de leads no WhatsApp sem rastreamento
- Sem atendimento 24/7 (consumidor pesquisa à noite, operação dorme)
- CRM desatualizado — equipe não alimenta o sistema
- Follow-up fraco dependente de disciplina humana

Dados de impacto:
- 391% mais conversão quando o lead é respondido em até 1 minuto
- 46% dos leads chegam fora do horário comercial — AutoPilot atende imediatamente
- Tempo médio de resposta do mercado: 94 minutos — AutoPilot responde em segundos
- Implementação: 30 dias para fluxos, 60 dias para CRM completo

Funcionalidades:
- CRM Kanban conversacional com múltiplos funis por produto, unidade ou equipe
- Inbox omnichannel: WhatsApp, Instagram, Facebook, Telegram unificados
- Distribuição automática de leads por regras de negócio
- Agentes de IA para qualificação, atendimento e follow-up 24/7
- Studio de Automação sem programação
- App mobile iOS e Android
- Integração com DMS, classificados e tabela FIPE
- Dashboards de velocidade, produtividade, conversão e governança
- Benchmarking entre lojas e vendedores

Mensagem por segmento:
- Concessionárias: atenda mais rápido, perca menos leads, venda com mais previsibilidade
- Grupos: padronize a operação entre lojas, reduza a dependência dos vendedores
- Montadoras: ganhe governança sobre o atendimento e performance da rede`,
    },
    {
      id: 'ki-nitroads-produto',
      title: 'NitroAds — Assessoria de Mídia Paga para Automotivo',
      category: 'produto',
      priority: 10,
      tags: ['nitroads', 'midia', 'ads', 'performance', 'trafego', 'roi'],
      content: `NitroAds — Assessoria de Mídia Paga Especializada no Setor Automotivo

Posicionamento: "Não vendemos cliques. Vendemos veículos vendidos."

Jornada completa: Anúncio → Landing Page/Site → CRM → Atendimento → Venda

Canais gerenciados:
- Google Ads (Search, Display e YouTube no plano MAX)
- Meta Ads (Facebook, Instagram e WhatsApp)
- LinkedIn Ads (vendas diretas, frotas e B2B)
- TikTok Ads (impacto, marca e públicos jovens)

O que está incluído:
- Setup técnico: contas, pixel Meta, conversões Google, GTM, GA4, CAPI Meta, UTMs
- Integração com site Autodromo e CRM AutoPilot
- Criação de campanhas e anúncios (texto, imagem, carrossel, vídeo) com suporte de IA
- Segmentação por modelo, campanha, interesse e geolocalização
- Dashboard e reports automáticos por e-mail e WhatsApp
- Reuniões de PDCA e otimizações frequentes

Diferenciais vs agência tradicional:
- Especialização 100% automotiva (novos, seminovos, test drive, financiamento, trade-in, consórcio, pós-venda)
- Integração real com Autodromo e AutoPilot CRM — rastreia do anúncio ao veículo vendido
- Modelo com taxa de sucesso vinculada a vendas reais, não só a cliques
- KPIs: CPL, conversão lead→venda, ROI, ticket médio, CAC, participação de mercado digital

Quando indicar: já investe em mídia mas não sabe o que vira venda; reclama de baixa qualidade dos leads; tem agência mas pouca visão de ROI; quer previsibilidade comercial.`,
    },
    {
      id: 'ki-portal-consorcios',
      title: 'Portal de Consórcios AutoForce',
      category: 'produto',
      priority: 30,
      tags: ['consorcio', 'site', 'autodromo', 'leads'],
      content: `Portal de Consórcios AutoForce

O que é: solução para concessionárias que trabalham com consórcio transformarem o site em canal ativo de captação de leads e vendas de cotas.

Benefícios:
- Vitrine digital de consórcios integrada ao site da concessionária
- Captação de leads qualificados interessados em consórcio
- Integração com fluxo de atendimento e CRM
- Canal adicional de receita sem custo operacional alto

Quando indicar: concessionária ou grupo que comercializa consórcio mas não tem canal digital estruturado para captar interessados.`,
    },
    {
      id: 'ki-ecossistema',
      title: 'Ecossistema Integrado AutoForce',
      category: 'produto',
      priority: 15,
      tags: ['autodromo', 'autopilot', 'nitroads', 'ecossistema', 'integracao'],
      content: `Ecossistema Integrado AutoForce

A combinação mais poderosa: Autodromo + AutoPilot + NitroAds

Como funciona junto:
1. NitroAds gera tráfego qualificado para o site
2. Autodromo converte o visitante em lead (PageSpeed 98, formulários, chat, vitrine de estoque)
3. AutoPilot recebe o lead, distribui, atende, qualifica e acompanha até a venda
4. Dashboards integrados mostram o caminho de cada lead do anúncio ao veículo vendido

Resultado: rastreabilidade total do clique à venda. Nenhum concorrente genérico oferece essa integração específica para o automotivo.

Argumentos de venda do ecossistema:
- "Hoje você tem três ferramentas que não conversam entre si — aqui é tudo integrado."
- "Você consegue rastrear qual anúncio gerou qual venda? Com o ecossistema AutoForce, sim."
- "O lead entra pela mídia, passa pelo site, cai no CRM e é atendido automaticamente."

AutoForce é o único fornecedor que oferece site, CRM, IA, mídia e consórcio integrados para o setor automotivo.`,
    },
    {
      id: 'ki-cases-autodromo',
      title: 'Cases de Sucesso — Autodromo',
      category: 'case',
      priority: 20,
      tags: ['autodromo', 'site', 'cms', 'case', 'leads', 'seo'],
      content: `Cases de Sucesso — Autodromo

Grupo Redencão:
Resultado: passou de menos de 10% das vendas pelo online para 50% das vendas de novos e seminovos pelo canal digital. +35% conversão de leads em 4 meses.
Produto: Autodromo
Depoimento: "Não tenho dúvidas: o site da AutoForce é o melhor site de concessionária do Brasil." — Henrique Potiguar

Guanabara Diesel:
Resultado: ampliou geração de leads qualificados e passou a fechar vendas de forma remota com mais eficiência.
Produto: Autodromo
Depoimento: "Hoje conseguimos capturar mais leads e até fechar vendas de forma remota. O Autodromo transformou nossa operação digital." — Mayara Oliveira, Gestora Comercial

Grupo Carmais:
Resultado: +45% leads qualificados em 6 meses; crescimento orgânico forte; redução de dependência de mídia paga; operação digital madura e integrada.
Produto: Autodromo + NitroAds
Depoimento: "Parte do que eu achei que seria um problema já estava resolvido com a estrutura dos sites da AutoForce." — Andre Azevedo, Diretor de Marketing e CRM`,
    },
    {
      id: 'ki-cases-grupo-crm',
      title: 'Cases de Sucesso — Grupos Automotivos e CRM',
      category: 'case',
      priority: 20,
      tags: ['autopilot', 'crm', 'grupo_automotivo', 'governanca', 'case', 'atendimento', 'nitroads'],
      content: `Cases de Sucesso — Grupos Automotivos e CRM

Grupo Linhares:
Resultado: 70% de taxa de conexão dos leads do site e 20% de conversão em vendas. Implantação concluída antes do prazo.
Produto: Autodromo + AutoPilot CRM
Depoimento: "Hoje temos um ecossistema digital conectado e eficiente." — Marcos Santana, Gerente de Marketing
Relevante para: grupos que querem integrar site + CRM e melhorar conexão com leads

GWM (Montadora):
Resultado: 13.000 leads em 5 meses; presença digital estruturada para a marca no Brasil.
Produto: Autodromo + NitroAds
Relevante para: montadoras e grupos que precisam escalar presença digital rapidamente`,
    },
    {
      id: 'ki-objecoes-autopilot',
      title: 'Objeções — AutoPilot CRM e Atendimento',
      category: 'objecao',
      priority: 25,
      tags: ['autopilot', 'crm', 'atendimento', 'objecao', 'whatsapp'],
      content: `Objeções Comuns — AutoPilot

"Já tenho CRM"
O ponto não é substituir um cadastro de leads. É garantir que o atendimento, o follow-up e a conversão aconteçam com velocidade, padrão e inteligência. O AutoPilot não é apenas CRM — é a camada operacional que faz o CRM trabalhar para vender.

"Meu time já atende pelo WhatsApp"
O problema não é atender pelo WhatsApp. É depender de cada vendedor para responder rápido, seguir padrão, registrar tudo, fazer follow-up e não perder oportunidade. O AutoPilot transforma o WhatsApp em operação governável.

"IA ainda é muito nova"
Justamente por isso ela precisa ser aplicada em jornadas objetivas, com controle, supervisão e indicadores. O AutoPilot não vende IA genérica — aplica IA onde existe perda real: atendimento, qualificação, recuperação e follow-up.

"Está caro"
Caro é perder lead pago, deixar cliente sem resposta, depender de vendedor inconsistente e não saber onde a venda está vazando. O AutoPilot deve ser comparado com o custo da ineficiência comercial, não com uma licença de software.`,
    },
    {
      id: 'ki-objecoes-nitroads',
      title: 'Objeções — NitroAds e Mídia Paga',
      category: 'objecao',
      priority: 25,
      tags: ['nitroads', 'midia', 'ads', 'objecao', 'roi', 'performance'],
      content: `Objeções Comuns — NitroAds

"Já tenho agência"
O NitroAds não é só uma agência — combina mídia, especialização automotiva, integração com CRM e taxa de sucesso vinculada às vendas. Sua agência atual consegue rastrear qual anúncio gerou qual veículo vendido?

"O investimento é alto"
O NitroAds reduz desperdício de mídia e aumenta vendas reais — é investimento em performance, não custo fixo. Quanto você perde hoje em mídia que não vira venda?

"Por que pagar taxa de sucesso se já pago mensalidade?"
A mensalidade cobre gestão, inteligência e otimização contínua. A taxa de sucesso é o nosso compromisso com a venda final — não só com geração de lead.

"Preciso pensar"
Enquanto você analisa, seus concorrentes seguem capturando leads da sua região. Posso pedir para um especialista fazer um diagnóstico rápido da sua operação de mídia?`,
    },
    {
      id: 'ki-objecoes-gerais',
      title: 'Objeções Gerais — Preço, Orçamento e Hesitação',
      category: 'objecao',
      priority: 30,
      tags: ['preco', 'comercial', 'contrato', 'qualificacao', 'objecao'],
      content: `Objeções Gerais — Preço e Orçamento

"Não tenho orçamento / está caro"
Entendo. Mas quanto custa hoje um site que não gera leads suficientes? Não é um custo — é um multiplicador de resultado. Vale a pena ver se faz sentido pro seu contexto. Posso conectar você com um especialista pra entender juntos.

"Preciso de mais tempo / vou ver depois"
Claro. Mas enquanto isso, sua concorrência está agindo agora. Posso agendar uma conversa rápida de 30 minutos com um especialista, sem compromisso, só pra ter mais clareza pra decidir?

"Não tenho poder de decisão"
Sem problema. Podemos incluir seu diretor na conversa? Posso ajudar você a preparar um argumento sólido para o superior sobre o impacto no faturamento.

"Nunca ouvi falar da AutoForce"
A AutoForce tem mais de 2.200 concessionárias na base e 10 anos de especialização no setor automotivo. Posso mostrar cases de quem estava na mesma situação.

"Manda tudo por e-mail"
Mando sim. Mas posso ser direto? Um PDF não responde suas dúvidas específicas. Que tal 30 minutos com um especialista pra ver como funciona na prática?`,
    },
    {
      id: 'ki-politica-contrato',
      title: 'Políticas Comerciais e de Contrato',
      category: 'politica',
      priority: 15,
      tags: ['preco', 'comercial', 'contrato', 'autodromo', 'politica'],
      content: `Políticas Comerciais AutoForce

Autodromo — Pagamento:
- Mensalidade via boleto ou PIX
- Setup parcelável em até 3x
- Valor pode ser rateado entre CNPJs do grupo

Contrato e garantia:
- Sem multas de cancelamento
- Cancelamento com 30 dias de aviso prévio
- Garantia de resultado em até 3 meses seguindo a metodologia AutoForce

Regras sobre preço:
- Nunca informar valores ou mensalidades — isso é papel do especialista após a demonstração
- Nunca prometer volume garantido de vendas, ROI específico ou crescimento automático
- Se perguntarem sobre preço: "O valor é personalizado para a operação de vocês — o especialista passa esse detalhe na conversa, ok?"`,
    },
    {
      id: 'ki-suporte-ebook',
      title: 'Suporte — Lead não recebeu o Ebook',
      category: 'suporte',
      priority: 5,
      tags: ['suporte', 'ebook', 'qualificacao', 'whatsapp'],
      content: `Suporte — Ebook não recebido

Situação: lead entrou em contato dizendo que não recebeu o ebook por e-mail.

Script de resposta:
"Pode ser que o e-mail tenha ido para a caixa de spam ou lixeira eletrônica — é bem comum isso acontecer. Dá uma olhada lá? Se não encontrar, me diz que te envio o link direto aqui no WhatsApp."

Link do ebook para enviar pelo WhatsApp:
https://www.canva.com/design/DAG7CfFrztc/-_itkuUcl8XbxTqxZtHppg/view?utm_content=DAG7CfFrztc&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hfac51b1dd2

Observação: Enviar o link diretamente no WhatsApp resolve na hora e evita dependência do e-mail. Não tentar qualificar durante o suporte — resolver a dúvida é o foco.`,
    },
    {
      id: 'ki-suporte-financeiro',
      title: 'Suporte — Contato com o Financeiro',
      category: 'suporte',
      priority: 5,
      tags: ['suporte', 'financeiro', 'contato', 'comercial'],
      content: `Suporte — Contato com o Financeiro/Administrativo

Situação: lead ou cliente precisa falar com o setor financeiro ou administrativo da AutoForce.

Script de resposta:
"Claro! Para questões financeiras, fala direto com a equipe pelo WhatsApp: https://wa.me/558499575795 — é o contato do financeiro da AutoForce.

Me diz brevemente o que aconteceu para eu já deixar um contexto pra eles? Assim você não precisa explicar tudo de novo."

Observação: Solicitar contexto antes de encaminhar agiliza o atendimento. Não tentar qualificar — encaminhar com eficiência.`,
    },
    {
      id: 'ki-suporte-contatos',
      title: 'Contatos de Suporte AutoForce',
      category: 'suporte',
      priority: 10,
      tags: ['suporte', 'contato', 'whatsapp', 'financeiro'],
      content: `Contatos de Suporte AutoForce

Suporte técnico (clientes ativos):
[E-MAIL SUPORTE — ex: suporte@autoforce.com.br]
WhatsApp: [NÚMERO SUPORTE]

Financeiro/Administrativo:
[E-MAIL FINANCEIRO — ex: financeiro@autoforce.com.br]

Comercial (novos clientes):
[E-MAIL COMERCIAL]
WhatsApp: [NÚMERO COMERCIAL]

Website: autoforce.com.br

[PREENCHER COM OS CONTATOS REAIS ANTES DE IR A PRODUÇÃO]

Regra: redirecionar com eficiência e empatia. Nunca deixar o lead sem um próximo passo claro.`,
    },
  ];

  for (const item of knowledgeItems) {
    await (prisma as any).aIKnowledgeItem.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        category: item.category,
        content: item.content,
        tags: item.tags,
        priority: item.priority,
        isActive: true,
      },
      create: {
        id: item.id,
        agentId: null,
        title: item.title,
        category: item.category,
        content: item.content,
        tags: item.tags,
        priority: item.priority,
        metadata: {},
        isActive: true,
      },
    });
  }

  console.log(`✅ ${knowledgeItems.length} itens de conhecimento criados/atualizados.`);

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
