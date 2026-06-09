# Planejamento de Automacoes e Jornadas

## Objetivo

Transformar a area de Automacao em um orquestrador central do inbound da AutoForce: entrada de leads, classificacao, comunicacao por e-mail e WhatsApp, IA de pre-qualificacao, agendamento e passagem para vendas/Pipedrive.

## Blocos essenciais

### Condicao

- Deve ter saidas explicitas: `Verdadeiro` e `Falso`.
- Cada saida deve ser salva na conexao do canvas com `sourceHandle`.
- O motor de execucao deve seguir `sourceHandle=true` quando a condicao passar e `sourceHandle=false` quando nao passar.
- Fluxos antigos sem `sourceHandle` continuam funcionando por fallback de ordem.

### WhatsApp

- Envia template aprovado via WhatsApp Business API.
- Registra toda mensagem enviada em historico de conversa.
- Recebe respostas e status pela rota de webhook da Meta.
- A conversa do lead deve ser visualizada no perfil do lead em formato de chat.

### Esperar resposta WhatsApp

Bloco futuro para controlar cadencias conversacionais.

Saidas esperadas:
- `Respondeu`
- `Nao respondeu`
- `Mensagem falhou`

Configuracoes esperadas:
- tempo maximo de espera;
- aceitar qualquer resposta ou apenas resposta com palavras-chave;
- opcao de parar cadencia quando o lead responder;
- opcao de encaminhar para IA quando responder.

### IA de pre-qualificacao

Objetivo:
- conversar com o lead quando ele responder no WhatsApp;
- identificar dor, perfil, urgencia, segmento, cargo e nivel de fit;
- gerar resumo da conversa;
- atualizar campos do lead;
- aplicar tags;
- definir se deve seguir para vendedor.

Configuracoes esperadas:
- objetivo da conversa;
- perguntas obrigatorias;
- criterios de qualificacao;
- criterios de desqualificacao;
- tom de voz;
- limite de mensagens;
- regra de transferencia para humano.

### Agendamento

Objetivo:
- quando a IA qualificar o lead, oferecer horarios e agendar com vendedor.

Integracoes possiveis:
- Google Calendar;
- link externo de agenda;
- agenda interna futura.

Dados a salvar:
- vendedor;
- data/hora;
- status do agendamento;
- resumo do lead;
- origem da qualificacao.

### Pipedrive

Objetivo:
- receber apenas leads qualificados ou eventos comerciais relevantes.

Acoes esperadas:
- criar pessoa;
- criar negocio;
- atualizar etapa;
- criar atividade;
- registrar nota com resumo da IA;
- marcar ganho/perdido quando aplicavel.

### E-mail pelo proprio sistema com Resend

O sistema tambem deve ter um canal proprio de envio de e-mail usando Resend.

Esse canal nao substitui necessariamente o RD Station. Ele serve para:
- e-mails transacionais;
- notificacoes internas;
- alertas para vendedor;
- mensagens pontuais dentro de jornadas;
- e-mails operacionais que nao precisam entrar em uma regua de marketing do RD Station.

Bloco futuro:
- `Enviar e-mail`

Configuracoes esperadas:
- remetente;
- destinatario: lead, vendedor, responsavel ou e-mail fixo;
- assunto;
- corpo do e-mail;
- template;
- variaveis do lead;
- tracking de envio, entrega, abertura e clique quando disponivel;
- fallback em caso de erro.

Variaveis de ambiente esperadas:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`

Tabela futura recomendada:
- `EmailMessage`

Campos principais:
- leadId;
- leadEmail;
- direction;
- provider;
- providerMessageId;
- subject;
- html;
- text;
- status;
- sentAt;
- deliveredAt;
- openedAt;
- clickedAt;
- failedAt;
- automationJourneyId;
- automationExecutionId.

## Ordem recomendada de implementacao

1. Condicao com saidas `Verdadeiro` e `Falso`.
2. Bloco `Esperar resposta WhatsApp`.
3. Motor de retomada por evento de resposta WhatsApp.
4. IA de pre-qualificacao conectada ao historico de conversa.
5. Agendamento.
6. Pipedrive com resumo e passagem para vendedor.
7. Envio de e-mail proprio via Resend.
