import type { ReactNode } from 'react';

/**
 * Lightweight rich-text renderer for article bodies stored in Supabase.
 *
 * Older rows were saved as a single line (headings like "## ..." appear
 * mid-paragraph and single "\n" separates ideas), while newer rows follow
 * markdown conventions ("\n\n" paragraphs, "## " headings, "**bold**", "- " lists).
 * This renderer normalizes both shapes into proper semantic HTML:
 *   - "## " / "### " blocks become <h2> / <h3>
 *   - consecutive "- " / "• " blocks become <ul><li>
 *   - **bold** spans become <strong>
 *   - everything else becomes <p>
 */

const splitInline = (text: string, keyPrefix: string): ReactNode[] => {
  // Split on **bold** spans, keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-s${i}`}>{part}</span>;
  });
};

export function renderRichText(raw: string): ReactNode[] {
  if (!raw) return [];

  // 1) Normalize: guarantee a line break before every heading marker,
  //    even when the whole body was saved as one long line.
  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\s*###\s+/g, '\n### ')
    .replace(/\s*##\s+/g, '\n## ');

  // 2) Split into blocks (paragraphs were written with "\n\n" or just "\n").
  const blocks = normalized.split(/\n+/).map((b) => b.trim()).filter(Boolean);

  const out: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul key={`ul-${key}`}>
        {listBuffer.map((item, i) => (
          <li key={`${key}-li${i}`}>{splitInline(item, `${key}-li${i}`)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  blocks.forEach((block, index) => {
    if (block.startsWith('### ')) {
      flushList(`pre-${index}`);
      out.push(<h3 key={`h3-${index}`}>{splitInline(block.slice(4), `h3-${index}`)}</h3>);
    } else if (block.startsWith('## ')) {
      flushList(`pre-${index}`);
      out.push(<h2 key={`h2-${index}`}>{splitInline(block.slice(3), `h2-${index}`)}</h2>);
    } else if (block.startsWith('- ') || block.startsWith('• ')) {
      listBuffer.push(block.replace(/^[-•]\s+/, ''));
    } else {
      flushList(`pre-${index}`);
      out.push(<p key={`p-${index}`}>{splitInline(block, `p-${index}`)}</p>);
    }
  });
  flushList('tail');

  return out;
}
