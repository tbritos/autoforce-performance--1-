import React, { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Code2, Database, FileText, Search } from 'lucide-react';
import systemDocs from '../SISTEMA_DOCUMENTACAO.md?raw';
import apiDocs from '../API_DOC.md?raw';
import readmeDocs from '../README.md?raw';

type DocTab = 'system' | 'api' | 'quick';

interface DocsViewProps {
  publicMode?: boolean;
  onBack?: () => void;
}

const DOCS: Array<{ id: DocTab; label: string; icon: React.ElementType; content: string }> = [
  { id: 'system', label: 'Sistema', icon: BookOpen, content: systemDocs },
  { id: 'api', label: 'API', icon: Code2, content: apiDocs },
  { id: 'quick', label: 'Inicio rapido', icon: FileText, content: readmeDocs },
];

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const extractHeadings = (content: string) =>
  content
    .split('\n')
    .filter(line => /^#{2,3}\s+/.test(line))
    .map(line => {
      const level = line.startsWith('###') ? 3 : 2;
      const text = line.replace(/^#{2,3}\s+/, '').trim();
      return { id: slug(text), text, level };
    })
    .slice(0, 60);

const isTableSeparator = (line: string) => /^\s*\|?[\s:-]+\|[\s|:-]+\|?\s*$/.test(line);

const parseTable = (lines: string[], start: number) => {
  const tableLines: string[] = [];
  let index = start;
  while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
    tableLines.push(lines[index]);
    index++;
  }

  if (tableLines.length < 2 || !isTableSeparator(tableLines[1])) {
    return null;
  }

  const rows = tableLines
    .filter((_, rowIndex) => rowIndex !== 1)
    .map(line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim()));

  return { rows, nextIndex: index };
};

const MarkdownContent: React.FC<{ content: string; query: string }> = ({ content, query }) => {
  const lines = useMemo(() => content.split('\n'), [content]);
  const nodes: React.ReactNode[] = [];
  const q = query.trim().toLowerCase();

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.replace('```', '').trim();
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index++;
      }
      index++;
      nodes.push(
        <div key={`code-${index}`} className="docs-code-wrap">
          {lang && <span className="docs-code-lang">{lang}</span>}
          <pre><code>{code.join('\n')}</code></pre>
        </div>
      );
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      const [head, ...body] = table.rows;
      nodes.push(
        <div key={`table-${index}`} className="docs-table-wrap">
          <table>
            <thead>
              <tr>{head.map((cell, cellIndex) => <th key={cellIndex}>{cell}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      index = table.nextIndex;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      const text = trimmed.slice(2);
      nodes.push(<h1 key={index} id={slug(text)}>{text}</h1>);
      index++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      const text = trimmed.slice(3);
      nodes.push(<h2 key={index} id={slug(text)}>{text}</h2>);
      index++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      const text = trimmed.slice(4);
      nodes.push(<h3 key={index} id={slug(text)}>{text}</h3>);
      index++;
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        items.push(lines[index].trim().slice(2));
        index++;
      }
      nodes.push(
        <ul key={`list-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
        </ul>
      );
      continue;
    }

    const paragraph: string[] = [trimmed];
    index++;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith('#') &&
      !lines[index].trim().startsWith('- ') &&
      !lines[index].trim().startsWith('```') &&
      !lines[index].includes('|')
    ) {
      paragraph.push(lines[index].trim());
      index++;
    }

    const text = paragraph.join(' ');
    if (!q || text.toLowerCase().includes(q)) {
      nodes.push(<p key={`p-${index}`}>{text}</p>);
    }
  }

  return <div className="docs-markdown">{nodes}</div>;
};

const DocsView: React.FC<DocsViewProps> = ({ publicMode = false, onBack }) => {
  const [activeTab, setActiveTab] = useState<DocTab>('system');
  const [query, setQuery] = useState('');
  const activeDoc = DOCS.find(doc => doc.id === activeTab) ?? DOCS[0];
  const headings = useMemo(() => extractHeadings(activeDoc.content), [activeDoc.content]);

  return (
    <div className="docs-page">
      <header className="docs-header">
        <div className="docs-brand">
          {onBack && (
            <button type="button" className="docs-icon-btn" onClick={onBack} aria-label="Voltar">
              <ArrowLeft size={17} />
            </button>
          )}
          <img
            src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg"
            alt="AutoForce"
          />
          <span>Documentacao</span>
        </div>
        <div className="docs-search">
          <Search size={15} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no documento ativo" />
        </div>
      </header>

      <main className="docs-shell">
        <aside className="docs-sidebar">
          <div className="docs-tab-list">
            {DOCS.map(doc => {
              const Icon = doc.icon;
              return (
                <button
                  key={doc.id}
                  type="button"
                  className={activeTab === doc.id ? 'active' : ''}
                  onClick={() => setActiveTab(doc.id)}
                >
                  <Icon size={15} />
                  <span>{doc.label}</span>
                </button>
              );
            })}
          </div>

          <div className="docs-index">
            <p>Indice</p>
            {headings.map(heading => (
              <a key={heading.id} href={`#${heading.id}`} className={heading.level === 3 ? 'sub' : ''}>
                {heading.text}
              </a>
            ))}
          </div>
        </aside>

        <section className="docs-content">
          <div className="docs-title-row">
            <div>
              <span className="docs-kicker">{publicMode ? 'Acesso publico' : 'Central interna'}</span>
              <h1>{activeDoc.label}</h1>
            </div>
            <div className="docs-api-pill">
              <Database size={14} />
              API-first
            </div>
          </div>
          <MarkdownContent content={activeDoc.content} query={query} />
        </section>
      </main>

      <style>{`
        .docs-page {
          min-height: 100vh;
          background: #f7f8fa;
          color: #111827;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .docs-header {
          position: sticky;
          top: 0;
          z-index: 20;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 28px;
          background: rgba(255,255,255,.92);
          border-bottom: 1px solid #e5e7eb;
          backdrop-filter: blur(12px);
        }

        .docs-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          font-weight: 700;
          color: #374151;
        }

        .docs-brand img {
          height: 22px;
          width: auto;
        }

        .docs-icon-btn {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          color: #4b5563;
          cursor: pointer;
        }

        .docs-search {
          width: min(420px, 42vw);
          height: 38px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #fff;
          color: #6b7280;
        }

        .docs-search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #111827;
          font-size: 13px;
        }

        .docs-shell {
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr);
          gap: 28px;
          max-width: 1480px;
          margin: 0 auto;
          padding: 28px;
        }

        .docs-sidebar {
          position: sticky;
          top: 88px;
          height: calc(100vh - 116px);
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .docs-tab-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .docs-tab-list button {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 10px 11px;
          border: 1px solid transparent;
          border-radius: 9px;
          background: transparent;
          color: #4b5563;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          text-align: left;
        }

        .docs-tab-list button.active {
          background: #fff;
          border-color: #dbeafe;
          color: #1d4ed8;
          box-shadow: 0 1px 3px rgba(15,23,42,.05);
        }

        .docs-index {
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
        }

        .docs-index p {
          margin: 0 0 10px;
          font-size: 11px;
          font-weight: 800;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .docs-index a {
          display: block;
          padding: 6px 0;
          color: #4b5563;
          font-size: 12px;
          line-height: 1.3;
          text-decoration: none;
        }

        .docs-index a.sub {
          padding-left: 12px;
          color: #6b7280;
        }

        .docs-index a:hover {
          color: #1d4ed8;
        }

        .docs-content {
          min-width: 0;
          padding: 30px 34px 56px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 10px 30px rgba(15,23,42,.04);
        }

        .docs-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 22px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 28px;
        }

        .docs-kicker {
          display: block;
          margin-bottom: 5px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: #2563eb;
        }

        .docs-title-row h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.1;
          color: #111827;
        }

        .docs-api-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .docs-markdown {
          max-width: 940px;
        }

        .docs-markdown h1,
        .docs-markdown h2,
        .docs-markdown h3 {
          scroll-margin-top: 86px;
          color: #111827;
        }

        .docs-markdown h1 {
          margin: 30px 0 14px;
          font-size: 30px;
        }

        .docs-markdown h2 {
          margin: 34px 0 12px;
          padding-top: 6px;
          font-size: 22px;
        }

        .docs-markdown h3 {
          margin: 24px 0 10px;
          font-size: 17px;
        }

        .docs-markdown p,
        .docs-markdown li {
          color: #374151;
          font-size: 14px;
          line-height: 1.7;
        }

        .docs-markdown ul {
          margin: 8px 0 16px;
          padding-left: 20px;
        }

        .docs-code-wrap {
          position: relative;
          margin: 12px 0 22px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #111827;
          background: #0f172a;
        }

        .docs-code-lang {
          position: absolute;
          top: 8px;
          right: 10px;
          font-size: 10px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .docs-code-wrap pre {
          margin: 0;
          padding: 18px;
          overflow: auto;
          color: #e5e7eb;
          font-size: 12px;
          line-height: 1.55;
        }

        .docs-table-wrap {
          width: 100%;
          overflow: auto;
          margin: 14px 0 24px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }

        .docs-table-wrap table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .docs-table-wrap th {
          background: #f9fafb;
          color: #374151;
          font-weight: 800;
          text-align: left;
        }

        .docs-table-wrap th,
        .docs-table-wrap td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .docs-table-wrap tr:last-child td {
          border-bottom: 0;
        }

        @media (max-width: 920px) {
          .docs-header {
            height: auto;
            align-items: stretch;
            flex-direction: column;
            padding: 14px 16px;
          }

          .docs-search {
            width: 100%;
          }

          .docs-shell {
            grid-template-columns: 1fr;
            padding: 16px;
          }

          .docs-sidebar {
            position: static;
            height: auto;
          }

          .docs-index {
            display: none;
          }

          .docs-content {
            padding: 22px 18px 40px;
          }

          .docs-title-row {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default DocsView;
