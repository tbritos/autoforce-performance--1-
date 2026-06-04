# QA Checklist — AutoForce Marketing Hub

Execute cada item e marque ✅ OK ou ❌ FALHOU com nota do erro.

---

## 1. Autenticação
- [ ] Login com Google redireciona para o dashboard
- [ ] Logout encerra a sessão corretamente
- [ ] Rota protegida sem login redireciona para /login

---

## 2. Lead Hub
- [ ] Lista de leads carrega com paginação
- [ ] Busca por nome filtra em tempo real
- [ ] Busca por email filtra corretamente
- [ ] Filtro por status (MQL, SQL, etc.) funciona
- [ ] Ordenação por data, score funciona
- [ ] Exportar CSV gera arquivo com dados
- [ ] Abrir perfil do lead mostra: dados, conversões, histórico de status
- [ ] Editar nome/empresa/telefone salva corretamente
- [ ] Adicionar tag funciona
- [ ] Remover tag funciona
- [ ] Mudar status do funil registra no histórico
- [ ] Anotações salva e exibe corretamente
- [ ] Lead com deal Pipedrive mostra seção "Funil Pipedrive"
- [ ] Timeline Pipedrive mostra eventos (stage_changed, won, lost)
- [ ] Link "Abrir no Pipedrive" abre URL correta

---

## 3. Automações — Canvas
- [ ] Criar nova jornada abre canvas vazio
- [ ] Arrastar blocos para o canvas funciona
- [ ] Clicar e arrastar canvas no espaço vazio move a viewport (pan)
- [ ] Cursor mão aberta em repouso, fechada ao arrastar
- [ ] Contador "X blocos · Y conexões" fica fixo no canto inferior
- [ ] Conectar dois blocos cria seta
- [ ] Remover conexão clicando no X funciona
- [ ] Duplo-clique no bloco abre modal de configuração
- [ ] Salvar alterações no modal persiste após F5
- [ ] Salvar rascunho salva sem erros
- [ ] Publicar ativa a jornada (badge verde "Ativa")
- [ ] Toggle liga/desliga a jornada na lista
- [ ] Delete/Backspace remove bloco selecionado

---

## 4. Automações — Blocos

### Trigger / Entrada
- [ ] Gatilho "Lead entrou na base" configurável
- [ ] Gatilho "Tag adicionada" com filtro de tag específica
- [ ] Gatilho "Status mudou" com filtro de status

### Condição
- [ ] Campo "tag" com operadores has_tag/not_has_tag
- [ ] Campo "score" com operadores >, <, >=, <=
- [ ] Campo "status" com comparação de etapa

### Esperar
- [ ] 2 minutos → retoma em ~2 min (verificar via Execuções)
- [ ] 1 hora → retoma em ~1 hora
- [ ] Badge "Aguardando" aparece no painel de Execuções

### Ação Interna
- [ ] Adicionar tag aplica tag no lead
- [ ] Remover tag remove tag do lead
- [ ] Adicionar score incrementa o score (ex: +10)
- [ ] Definir score seta o score para o valor exato
- [ ] Mudar etapa atualiza o status do lead

### RD Station
- [ ] Preencher "Identificador da conversão" (ex: lead_qualificado)
- [ ] Após execução, conversão aparece no lead no RD Station
- [ ] Lead não existente no RD é criado automaticamente

### WhatsApp
- [ ] Seletor de número mostra números disponíveis
- [ ] Ao trocar número, templates recarregam
- [ ] Mensagem enviada aparece no WhatsApp do lead

### Pipedrive
- [ ] create_deal cria negócio no Pipedrive
- [ ] Referência da Origem é preenchida com utm_campaign da última conversão
- [ ] update_stage move o deal vinculado ao lead (não outro deal)
- [ ] mark_won fecha o deal do lead como ganho
- [ ] mark_lost fecha o deal do lead como perdido com motivo

---

## 5. Automações — Execuções
- [ ] Botão Testar abre modal com busca de leads
- [ ] Buscar lead por nome funciona no modal
- [ ] Executar com lead válido cria execução
- [ ] Painel de Execuções abre com stats (Rodando/Aguardando/Concluídos/Falhou)
- [ ] Expandir execução mostra log por bloco com timestamp
- [ ] Erro no bloco aparece em vermelho com mensagem clara
- [ ] Atualizar botão no drawer recarrega execuções

---

## 6. Conexões
- [ ] Todos os cards de plataforma visíveis
- [ ] Plataformas conectadas mostram badge verde
- [ ] Botão Testar retorna feedback (sucesso ou erro)
- [ ] WhatsApp mostra env vars WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID
- [ ] WhatsApp NÃO tem botão "Configurar"
- [ ] Sincronizar Pipedrive manualmente funciona

---

## 7. UTM Links
- [ ] Lista de links carrega
- [ ] Criar link preenche URL completa com UTMs
- [ ] Copiar URL funciona
- [ ] Short URL gerada é acessível

---

## 8. Webhook Pipedrive (tempo real)
- [ ] Mover deal de estágio no Pipedrive → evento aparece na Timeline do lead em < 10s
- [ ] Ganhar deal no Pipedrive → status do lead muda para Cliente
- [ ] Perder deal no Pipedrive → status do lead muda para Perdido

---

## Resultado final
- Total testado: ___
- Passou: ___
- Falhou: ___
- Notas:
