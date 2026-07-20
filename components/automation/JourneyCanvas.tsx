import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  Handle, Position, useReactFlow, BaseEdge, EdgeLabelRenderer, getBezierPath, applyNodeChanges,
  type Node, type Edge, type NodeProps, type EdgeProps, type NodeChange, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AutomationJourneyNode, AutomationJourneyEdge, AutomationNodeType } from '../../types';
import { blockMeta, nodeSubtitle, NODE_W, NODE_H } from './journey-blocks';

// ─── Data adapters ────────────────────────────────────────────────────────────
// AutomationJourneyNode/Edge (formato salvo no banco, sem mudança) ↔ formato do
// React Flow. A conversão acontece só na borda de renderização.

type BlockNode = Node<{ node: AutomationJourneyNode }, 'block'>;
type JourneyEdgeType = Edge<{ color: string; label: string }, 'journey'>;

interface OutputDef {
  handle: string;
  label: string;
  color: string;
  top: string;
}

function outputsFor(node: AutomationJourneyNode): OutputDef[] {
  if (node.type === 'condition') {
    return [
      { handle: 'true', label: 'Verdadeiro', color: 'var(--green-500)', top: '66%' },
      { handle: 'false', label: 'Falso', color: 'var(--red-500)', top: '90%' },
    ];
  }
  if (node.type === 'whatsapp_wait_reply') {
    return [
      { handle: 'replied', label: 'Respondeu', color: 'var(--green-500)', top: '58%' },
      { handle: 'no_reply', label: 'Não respondeu', color: '#F59E0B', top: '76%' },
      { handle: 'failed', label: 'Falhou', color: 'var(--red-500)', top: '94%' },
    ];
  }
  if (node.type === 'email_wait_event') {
    const c = (node.config ?? {}) as Record<string, string>;
    const isReply = c.waitForEvent === 'received' || c.waitForEvent === 'reply';
    return [
      { handle: 'event', label: isReply ? 'Respondeu' : 'Abriu/Clicou', color: 'var(--green-500)', top: '66%' },
      { handle: 'timeout', label: isReply ? 'Não respondeu' : 'Não abriu', color: '#F59E0B', top: '90%' },
    ];
  }
  return [{ handle: 'default', label: 'Conectar', color: blockMeta(node.type).color, top: '50%' }];
}

function edgeVisual(edge: AutomationJourneyEdge, sourceNode?: AutomationJourneyNode): { color: string; label: string } {
  const h = edge.sourceHandle;
  const c = (sourceNode?.config ?? {}) as Record<string, string>;
  const isReply = c.waitForEvent === 'received' || c.waitForEvent === 'reply';
  const color =
    h === 'true' || h === 'replied' || h === 'event' ? 'var(--green-500)' :
    h === 'false' || h === 'failed' ? 'var(--red-500)' :
    h === 'no_reply' || h === 'timeout' ? '#F59E0B' :
    'var(--accent)';
  const label =
    h === 'true' ? 'Verdadeiro' :
    h === 'false' ? 'Falso' :
    h === 'replied' ? 'Respondeu' :
    h === 'no_reply' ? 'Não respondeu' :
    h === 'failed' ? 'Falhou' :
    h === 'event' ? (isReply ? 'Respondeu' : 'Abriu/Clicou') :
    h === 'timeout' ? (isReply ? 'Não respondeu' : 'Não abriu') :
    '';
  return { color, label };
}

// ─── Custom node ──────────────────────────────────────────────────────────────

const JourneyBlockNode: React.FC<NodeProps<BlockNode>> = ({ data, selected }) => {
  const { node } = data;
  const meta = blockMeta(node.type);
  const Icon = meta.icon;
  const sub = nodeSubtitle(node);
  const outputs = outputsFor(node);
  const multiOutput = outputs.length > 1;

  return (
    <div
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        border: `1.5px solid ${selected ? meta.color : sub.warn ? '#F59E0B' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)',
        background: 'var(--bg-surface)',
        boxShadow: selected ? `0 0 0 3px ${meta.color}22` : 'var(--shadow-sm)',
        padding: 12,
        position: 'relative',
      }}
    >
      {node.type !== 'trigger' && (
        <Handle type="target" position={Position.Left} style={{ top: '50%', width: 10, height: 10, background: 'var(--fg-subtle)', border: '2px solid var(--bg-surface)' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ position: 'relative', width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: `${meta.color}22`, color: meta.color, flexShrink: 0 }}>
          <Icon size={16} />
          {sub.warn && (
            <span style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 999, background: '#F59E0B', border: '2px solid var(--bg-surface)' }} />
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', color: 'var(--fg-primary)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</strong>
          <span style={{ display: 'block', color: sub.warn ? '#F59E0B' : 'var(--fg-muted)', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sub.text}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: multiOutput ? 'column' : 'row', gap: 6, marginTop: 10 }}>
        {outputs.map(output => (
          <div key={output.handle} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{
              fontSize: multiOutput ? 10 : 11, fontWeight: 800, color: output.color,
              background: `${output.color}18`, borderRadius: 'var(--r-sm)', padding: '4px 18px 4px 7px',
              whiteSpace: 'nowrap',
            }}>
              {output.label}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={output.handle}
              style={{ position: 'absolute', top: '50%', right: -6, width: 10, height: 10, background: output.color, border: '2px solid var(--bg-surface)' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const nodeTypes = { block: JourneyBlockNode };

// ─── Custom edge ──────────────────────────────────────────────────────────────

const JourneyEdge: React.FC<EdgeProps<JourneyEdgeType>> = ({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd,
}) => {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const color = data?.color ?? 'var(--accent)';
  const label = data?.label ?? '';

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: 2 }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          className="nodrag nopan"
        >
          {label && (
            <span style={{ fontSize: 10, fontWeight: 800, color, background: 'var(--bg-app)', padding: '1px 5px', borderRadius: 4 }}>
              {label}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = { journey: JourneyEdge };

// ─── Main component ───────────────────────────────────────────────────────────

export interface JourneyCanvasProps {
  nodes: AutomationJourneyNode[];
  edges: AutomationJourneyEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onNodePositionChange: (id: string, x: number, y: number) => void;
  onConnect: (connection: Connection) => void;
  onRemoveEdge: (id: string) => void;
  onOpenNodeModal: (id: string) => void;
  onDropBlock: (type: AutomationNodeType, x: number, y: number) => void;
}

function toFlowNode(node: AutomationJourneyNode, selectedNodeId: string | null): BlockNode {
  return {
    id: node.id,
    type: 'block',
    position: { x: node.x, y: node.y },
    selected: node.id === selectedNodeId,
    data: { node },
  };
}

const JourneyCanvasInner: React.FC<JourneyCanvasProps> = ({
  nodes, edges, selectedNodeId, onSelectNode, onNodePositionChange, onConnect, onRemoveEdge, onOpenNodeModal, onDropBlock,
}) => {
  const { screenToFlowPosition } = useReactFlow();

  // Estado local espelhando os nós pro React Flow — necessário pra preservar os
  // campos internos que a lib usa (`measured`, dimensões etc.) entre re-renders.
  // Recalcular os nós do zero a cada mudança externa (ex: a cada pixel de um
  // arrasto) fazia a lib "esquecer" que o nó já foi medido e soltar o aviso
  // "tentando arrastar nó não inicializado". Posição/seleção/config sempre vêm
  // do `nodes`/`selectedNodeId` (fonte da verdade); só o resto é preservado.
  const [flowNodes, setFlowNodes] = useState<BlockNode[]>(() => nodes.map(n => toFlowNode(n, selectedNodeId)));

  useEffect(() => {
    setFlowNodes(prevFlow => {
      const prevById = new Map(prevFlow.map(n => [n.id, n]));
      return nodes.map(node => {
        const prev = prevById.get(node.id);
        if (prev) return { ...prev, selected: node.id === selectedNodeId, data: { node } };
        return toFlowNode(node, selectedNodeId);
      });
    });
  }, [nodes, selectedNodeId]);

  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const flowEdges: JourneyEdgeType[] = useMemo(() => edges.map(edge => {
    const visual = edgeVisual(edge, nodeById.get(edge.source));
    return {
      id: edge.id,
      type: 'journey',
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      data: visual,
    };
  }), [edges, nodeById]);

  const handleNodesChange = useCallback((changes: NodeChange<BlockNode>[]) => {
    setFlowNodes(prev => applyNodeChanges<BlockNode>(changes, prev));
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        onNodePositionChange(change.id, Math.max(12, change.position.x), Math.max(12, change.position.y));
      }
    }
  }, [onNodePositionChange]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/x-automation-node') as AutomationNodeType;
    if (!type) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onDropBlock(type, Math.max(20, position.x - NODE_W / 2), Math.max(20, position.y - 30));
  }, [screenToFlowPosition, onDropBlock]);

  return (
    <div
      style={{ position: 'absolute', inset: 0 }}
      onDrop={handleDrop}
      onDragOver={event => event.preventDefault()}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onConnect={onConnect}
        onNodeClick={(event, node) => { event.stopPropagation(); onSelectNode(node.id); }}
        onNodeDoubleClick={(event, node) => { event.stopPropagation(); onOpenNodeModal(node.id); }}
        onPaneClick={() => onSelectNode(null)}
        onEdgeClick={(event, edge) => { event.stopPropagation(); onRemoveEdge(edge.id); }}
        deleteKeyCode={null}
        minZoom={0.15}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={n => blockMeta((n.data as { node: AutomationJourneyNode }).node.type).color}
          maskColor="rgba(0,0,0,0.05)"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        />
      </ReactFlow>

      {nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--fg-muted)', fontSize: 14, pointerEvents: 'none' }}>
          Arraste blocos da barra acima para montar a jornada.
        </div>
      )}
    </div>
  );
};

export const JourneyCanvas: React.FC<JourneyCanvasProps> = (props) => (
  <ReactFlowProvider>
    <JourneyCanvasInner {...props} />
  </ReactFlowProvider>
);
