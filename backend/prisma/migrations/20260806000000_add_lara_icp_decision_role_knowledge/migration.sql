INSERT INTO "AIKnowledgeItem" (
  "id",
  "agentId",
  "title",
  "category",
  "content",
  "tags",
  "priority",
  "isActive",
  "sourceUrl",
  "metadata",
  "createdAt",
  "updatedAt"
)
VALUES (
  'ki-icp-poder-decisao',
  NULL,
  'ICP — Poder de decisão do contato',
  'regra',
  E'ICP — Poder de decisão do contato\n\nConsultor(a) de vendas, consultor(a) comercial e vendedor(a) NÃO fazem parte do ICP da Lara, mesmo quando trabalham em uma concessionária, grupo automotivo, montadora ou revenda elegível.\n\nMotivo: esses cargos executam a operação comercial, mas não possuem poder de decisão para contratar as soluções da AutoForce.\n\nQuando o cargo estiver confirmado como um desses:\n- classificar como fit=disqualified;\n- manter o score Lara entre 0 e 39;\n- não marcar como lead quente;\n- não oferecer reunião nem horários de agenda;\n- não tentar contornar a regra pedindo para incluir um diretor.\n\nNão inferir o cargo. Só aplicar quando o dado estiver cadastrado ou tiver sido informado claramente pelo contato. Outros cargos operacionais cuja autoridade ainda seja desconhecida podem permanecer em nutrição até o papel ser esclarecido.',
  ARRAY['icp', 'qualificacao', 'whatsapp', 'cargo', 'decisor', 'vendedor']::TEXT[],
  4,
  TRUE,
  NULL,
  '{}'::JSONB,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "category" = EXCLUDED."category",
  "content" = EXCLUDED."content",
  "tags" = EXCLUDED."tags",
  "priority" = EXCLUDED."priority",
  "isActive" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP;
