import React from 'react';
import {
  Zap, GitBranch, Clock, MessageCircle, MailOpen, Bot, Tags, Mail, Database,
} from 'lucide-react';
import { AutomationNodeType, AutomationJourneyNode } from '../../types';

// Compartilhado entre AutomationJourneysView (toolbar de blocos) e JourneyCanvas
// (card do nó) — extraído pra evitar import circular entre os dois.

export const NODE_W = 230;
export const NODE_H = 88;

export const BLOCKS: Array<{
  type: AutomationNodeType;
  label: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}> = [
  { type: 'trigger',          label: 'Entrada',      description: 'Lead entrou, tag aplicada ou webhook recebido',  color: '#456CEC', icon: Zap },
  { type: 'condition',        label: 'Condição',     description: 'Cargo, tag, score, dor, origem ou campo',        color: '#22C55E', icon: GitBranch },
  { type: 'wait',             label: 'Esperar',      description: 'Aguardar horas ou dias antes do próximo passo',  color: '#F59E0B', icon: Clock },
  { type: 'whatsapp_wait_reply', label: 'Esperar resposta', description: 'Aguardar resposta do lead no WhatsApp',    color: '#10B981', icon: MessageCircle },
  { type: 'email_wait_event',  label: 'Evento de email', description: 'Aguardar abertura, clique ou resposta do email', color: '#3B82F6', icon: MailOpen },
  { type: 'ai_prequalify',     label: 'IA',           description: 'Pre-qualificar conversa e atualizar o lead',      color: '#6366F1', icon: Bot },
  { type: 'internal_action',  label: 'Ação interna', description: 'Adicionar tag, score, etapa ou campo',           color: '#14B8A6', icon: Tags },
  { type: 'rd_conversion',    label: 'RD Station',   description: 'Criar conversão para entrar em fluxo de e-mail', color: '#8B5CF6', icon: Mail },
  { type: 'whatsapp_message', label: 'WhatsApp',     description: 'Enviar template ou mensagem da cadência',        color: '#10B981', icon: MessageCircle },
  { type: 'pipedrive_action', label: 'Pipedrive',    description: 'Criar ou atualizar negócio comercial',           color: '#EF4444', icon: Database },
  { type: 'send_email',      label: 'Enviar Email', description: 'Enviar email via Resend com template personalizado', color: '#3B82F6', icon: Mail },
];

export const blockMeta = (type: AutomationNodeType) => BLOCKS.find(block => block.type === type) ?? BLOCKS[0];

export function nodeSubtitle(node: AutomationJourneyNode): { text: string; warn: boolean } {
  const c = (node.config ?? {}) as Record<string, string>;
  switch (node.type) {
    case 'trigger': {
      if (!c.event) return { text: '⚠ Configure o gatilho', warn: true };
      const labels: Record<string, string> = {
        lead_created:   'Lead entrou na base',
        conversion_received: c.eventValue ? `Conversão: ${c.eventValue}` : 'Conversão específica',
        tag_added:      c.eventValue ? `Tag: ${c.eventValue}` : 'Tag aplicada',
        score_reached:  c.eventValue ? `Score ≥ ${c.eventValue}` : 'Score atingiu limite',
        status_changed: c.eventValue ? `Etapa → ${c.eventValue}` : 'Etapa mudou',
        email_received: c.eventValue ? `Email recebido: ${c.eventValue}` : 'Email recebido',
        segment_entered: 'Entrou em segmento',
      };
      return { text: labels[c.event] ?? c.event, warn: false };
    }
    case 'wait':
      if (c.amount && c.unit) return { text: `Aguardar ${c.amount} ${c.unit}`, warn: false };
      return { text: 'Definir tempo...', warn: false };
    case 'whatsapp_wait_reply':
      if (c.amount && c.unit) return { text: `Resposta por até ${c.amount} ${c.unit}`, warn: false };
      return { text: 'Definir prazo de resposta...', warn: false };
    case 'email_wait_event': {
      const eventLabel = c.waitForEvent === 'received' || c.waitForEvent === 'reply'
        ? 'resposta'
        : c.waitForEvent === 'clicked' ? 'clique' : 'abertura';
      if (c.timeoutAmount && c.timeoutUnit) return { text: `${eventLabel} por até ${c.timeoutAmount} ${c.timeoutUnit}`, warn: false };
      return { text: 'Definir condição de email...', warn: false };
    }
    case 'ai_prequalify':
      return { text: c.goal || 'Analisar conversa e qualificar lead', warn: false };
    case 'condition':
      if (c.field && c.value) return { text: `${c.field} ${c.operator ?? ''} ${c.value}`.trim(), warn: false };
      return { text: 'Definir condição...', warn: false };
    case 'internal_action': {
      const labels: Record<string, string> = {
        add_tag:    c.value ? `+tag: ${c.value}` : 'Adicionar tag',
        remove_tag: c.value ? `-tag: ${c.value}` : 'Remover tag',
        set_status: c.value ? `Etapa: ${c.value}` : 'Mudar etapa',
        add_score:  c.value ? `+${c.value} pts` : 'Adicionar score',
        set_score:  c.value ? `Score: ${c.value}` : 'Definir score',
      };
      return { text: c.action ? (labels[c.action] ?? c.action) : 'Definir ação...', warn: false };
    }
    case 'rd_conversion':
      return { text: c.conversionName || c.conversionIdentifier || 'Configurar conversão...', warn: false };
    case 'whatsapp_message':
      return { text: c.templateName || 'Selecionar template...', warn: false };
    case 'send_email':
      return { text: c.templateName ? String(c.templateName) : (c.subject ? String(c.subject) : 'Configurar email...'), warn: false };
    case 'pipedrive_action': {
      const labels: Record<string, string> = {
        create_deal:  c.pipeline ? `Criar · ${c.pipeline === 'novo_cliente' ? 'Novo Cliente' : 'Upsell'}` : 'Criar negócio',
        update_stage: 'Mudar estágio',
        mark_won:     'Marcar como ganho',
        mark_lost:    'Marcar como perdido',
      };
      return { text: c.action ? (labels[c.action] ?? c.action) : 'Definir ação...', warn: false };
    }
    default:
      return { text: blockMeta(node.type).label, warn: false };
  }
}
