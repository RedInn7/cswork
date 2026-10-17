import { unzip } from './zip';

/**
 * The resume builder's "Import PDF / DOCX" (components/resume-builder.tsx): the file is read in
 * this browser into plain text for parseResumeText, never uploaded. A .docx is unzipped and its
 * document.xml scanned; a PDF goes to pdf.js in a sandboxed iframe (pdfPages) and its text items
 * are put back into lines (pdfLines). Failures throw an Error whose message is a ResumeFileError.
 */
export const RESUME_FILE_MAX = 5 * 1024 * 1024;
export const RESUME_TEXT_MAX = 20_000;
// A 5 MB .docx whose document.xml inflates past this is a zip bomb, not a resume.
const XML_MAX = 30 * 1024 * 1024;
export type ResumeFileError = 'too-big' | 'type' | 'docx' | 'pdf' | 'scanned';

export async function readResumeFile(file: Blob): Promise<string> {
  const fail = (code: ResumeFileError) => new Error(code);
  if (file.size > RESUME_FILE_MAX) throw fail('too-big');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  let text: string;
  if (magic.startsWith('PK')) {
    const files = await unzip(bytes, (name) => name === 'word/document.xml', XML_MAX).catch(() => null);
    const xml = files?.get('word/document.xml');
    if (!xml) throw fail('docx');
    text = docxText(new TextDecoder().decode(xml));
    if (!text) throw fail('docx');
  } else if (magic === '%PDF') {
    text = pdfLines(await pdfPages(bytes));
    if (!text.trim()) throw fail('scanned');
  } else throw fail('type');
  return text.slice(0, RESUME_TEXT_MAX);
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const point = (n: number) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');
const decode = (s: string) =>
  s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(\w+));/gi, (m, hex?: string, dec?: string, name?: string) =>
    hex ? point(parseInt(hex, 16)) : dec ? point(Number(dec)) : (ENTITIES[name!] ?? m),
  );
// A text box is written twice (DrawingML and a VML fallback); moved text sits at both ends of the move.
const SKIP = /<(mc:Fallback|w:moveFrom)\b[^>]*>[\s\S]*?<\/\1>/g;
const TOKEN = /<w:p\b[^>]*?(\/)?>|<\/w:p>|<w:(?:br|cr)\b[^>]*\/>|<w:tab\/>|<w:ptab\b[^>]*\/>|<\/w:t[cr]>|<w:numPr>|<w:pStyle w:val="List[^"]*"|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
/**
 * A .docx's word/document.xml as lines of text. A paragraph or break ends a line; a tab and a
 * table cell end in a tab, so a date laid out in a table or behind a tab stop splits off in
 * parseResumeText; a Word list paragraph gets the "• " its numbering would draw.
 */
export function docxText(xml: string) {
  const out: string[] = [];
  let bulleted = false;
  // The end of a cell or row replaces the line break of the paragraph it closes.
  const end = (sep: string) => {
    if (out.length && /^[\n\t]$/.test(out[out.length - 1])) out[out.length - 1] = sep;
    else out.push(sep);
  };
  for (const [tag, empty, text] of xml.replace(SKIP, '').matchAll(TOKEN)) {
    if (text !== undefined) out.push(decode(text));
    else if (tag === '</w:p>') out.push('\n');
    else if (/^<w:p[\s/>]/.test(tag)) {
      bulleted = false;
      if (empty) out.push('\n');
    } else if (tag === '</w:tc>') end('\t');
    else if (tag === '</w:tr>') end('\n');
    else if (tag === '<w:numPr>' || tag.startsWith('<w:pStyle')) {
      if (!bulleted) out.push('• ');
      bulleted = true;
    } else out.push(/^<w:(br|cr)\b/.test(tag) ? '\n' : '\t');
  }
  return out.join('').replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n').trim();
}

/** One text run from pdf.js: its string, baseline origin (PDF units, y up), width and height. */
export type PdfItem = { s: string; x: number; y: number; w: number; h: number };
export type PdfPage = { w: number; items: PdfItem[] };
type Line = { y: number; h: number; items: PdfItem[] };

/** Items top to bottom as lines: a baseline within half a line height of the line's joins it. */
function group(items: PdfItem[]) {
  const lines: Line[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - item.y) < 0.5 * Math.max(line.h, item.h)) {
      line.items.push(item);
      line.h = Math.max(line.h, item.h);
    } else lines.push({ y: item.y, h: item.h, items: [item] });
  }
  return lines;
}
/** A line's runs left to right: runs that touch are one word, a gap is a space, past two characters' width two spaces. */
function lineText(line: Line) {
  let text = '';
  let end = 0;
  let char = 0;
  for (const item of [...line.items].sort((a, b) => a.x - b.x)) {
    const gap = item.x - end;
    const spaced = /\s$/.test(text) || /^\s/.test(item.s);
    text = text.trimEnd();
    if (text) text += gap > 2 * char ? '  ' : spaced || gap > 0.2 * char ? ' ' : '';
    text += item.s.trimStart();
    end = item.x + item.w;
    char = item.w / Math.max(1, item.s.length) || item.h / 2;
  }
  return text.trimEnd();
}
/**
 * Where a page could split into two columns: the middle of the widest strip between 30% and 70% of
 * the page width that no run crosses, and that strip's width; null when there is none.
 */
function seam(items: PdfItem[], width: number) {
  const [left, right] = [0.3 * width, 0.7 * width];
  let from = left;
  let best: { x: number; gap: number } | null = null;
  for (const item of [...items, { x: right, w: 0 }].sort((a, b) => a.x - b.x)) {
    const to = Math.min(item.x, right);
    if (to - from > Math.max(best?.gap ?? 0, 0.01 * width)) best = { x: (from + to) / 2, gap: to - from };
    from = Math.max(from, item.x + item.w);
  }
  return best;
}
/**
 * The text of pdf.js's text runs, page by page. A page is read as two columns, the left one and
 * then the right, when a vertical strip between 30% and 70% of the width is crossed by no run below
 * its header, at least 30% of those lines have text on both sides of it, and each side holds at
 * least 15% of the text. The header (a centred name over both columns) is the leading lines, up to
 * five and at most half the page, whose removal opens that strip or widens it by more than a
 * quarter. The text share keeps a one-column page whose bullets all stop short of the right-aligned
 * dates in one piece.
 */
export function pdfLines(pages: PdfPage[]) {
  return pages
    .map(({ w, items }) => {
      const lines = group(items);
      const plain = () => lines.map(lineText).join('\n');
      let top = 0;
      let found = seam(items, w);
      for (let k = 1; k <= Math.min(5, lines.length / 2); k++) {
        const next = seam(lines.slice(k).flatMap((l) => l.items), w);
        if (next && next.gap > (found?.gap ?? 0) * 1.25) [top, found] = [k, next];
      }
      if (!found) return plain();
      const { x } = found;
      const body = lines.slice(top);
      const both = body.filter((l) => l.items.some((i) => i.x < x) && l.items.some((i) => i.x > x)).length;
      const text = (left: boolean) => body.reduce((n, l) => n + l.items.reduce((m, i) => m + ((i.x < x) === left ? i.s.length : 0), 0), 0);
      if (both < 0.3 * body.length || Math.min(text(true), text(false)) < 0.15 * (text(true) + text(false))) return plain();
      const side = (left: boolean) => group(body.flatMap((l) => l.items.filter((i) => (i.x < x) === left)));
      return [...lines.slice(0, top), ...side(true), ...side(false)].map(lineText).join('\n');
    })
    .join('\n')
    .trim();
}

export const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
const PDF_PAGES = 4;
/**
 * The reader page's CSP: pdf.js's pinned directory (module, worker, CMaps) and nothing else. The
 * page's origin is opaque, so pdf.js starts its worker from a blob that imports the worker module,
 * or falls back to importing that module here: script-src and worker-src both allow the directory.
 */
export const PDF_SANDBOX_CSP = `default-src 'none'; script-src 'unsafe-inline' ${PDFJS_URL}; worker-src blob: ${PDFJS_URL}; connect-src ${PDFJS_URL}`;
/**
 * The hidden iframe's page (srcdoc, sandbox="allow-scripts", no allow-same-origin), so pdf.js and
 * whatever the file holds never run with this site's origin. It says "ready", reads the PDF bytes
 * it is sent with eval off and no font loading (CMaps for CJK fonts), and posts back the first
 * pages' text runs, or "error".
 */
export function pdfSandboxSource() {
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PDF_SANDBOX_CSP}"><script type="module">
const base = ${JSON.stringify(PDFJS_URL)};
onmessage = async (event) => {
  if (event.source !== parent) return;
  try {
    const lib = await import(base + "build/pdf.min.mjs");
    lib.GlobalWorkerOptions.workerSrc = base + "build/pdf.worker.min.mjs";
    const doc = await lib.getDocument({ data: event.data, isEvalSupported: false, disableFontFace: true, cMapUrl: base + "cmaps/", cMapPacked: true }).promise;
    const pages = [];
    for (let n = 1; n <= Math.min(doc.numPages, ${PDF_PAGES}); n++) {
      const page = await doc.getPage(n);
      const [x0, y0, x1] = page.view;
      const { items } = await page.getTextContent();
      pages.push({
        w: x1 - x0,
        items: items.filter((i) => i.str && i.str.trim()).map((i) => ({
          s: i.str, x: i.transform[4] - x0, y: i.transform[5] - y0, w: i.width, h: i.height || Math.hypot(i.transform[2], i.transform[3]),
        })),
      });
    }
    parent.postMessage({ type: "pages", pages }, "*");
  } catch (error) {
    parent.postMessage({ type: "error", message: String((error && error.name) || error) }, "*");
  }
};
parent.postMessage({ type: "ready" }, "*");
</script>`;
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** What the sandbox posted, as pages: anything else in the message is dropped. */
function cleanPages(raw: unknown): PdfPage[] {
  return list(raw)
    .slice(0, PDF_PAGES)
    .map((p) => {
      const page = (p ?? {}) as { w?: unknown; items?: unknown };
      return {
        w: num(page.w, 612),
        items: list(page.items)
          .slice(0, 20_000)
          .map((v) => {
            const i = (v ?? {}) as Partial<Record<keyof PdfItem, unknown>>;
            return { s: String(i.s ?? '').slice(0, 2000), x: num(i.x), y: num(i.y), w: num(i.w), h: num(i.h) || 10 };
          }),
      };
    });
}

/** The first pages' text runs of a PDF, read by pdf.js (from jsDelivr) in a throwaway sandbox; rejects with 'pdf' after 30 s. */
export function pdfPages(bytes: Uint8Array, timeoutMs = 30_000): Promise<PdfPage[]> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.title = 'PDF reader';
    frame.hidden = true;
    frame.srcdoc = pdfSandboxSource();
    const end = (pages?: PdfPage[]) => {
      clearTimeout(timer);
      window.removeEventListener('message', listen);
      frame.remove();
      if (pages) resolve(pages);
      else reject(new Error('pdf' satisfies ResumeFileError));
    };
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const data = event.data as { type?: unknown; pages?: unknown } | null;
      if (data?.type === 'ready') {
        const copy = bytes.slice();
        frame.contentWindow?.postMessage(copy.buffer, '*', [copy.buffer]);
      } else if (data?.type === 'pages') end(cleanPages(data.pages));
      else if (data?.type === 'error') end();
    };
    const timer = setTimeout(() => end(), timeoutMs);
    window.addEventListener('message', listen);
    document.body.append(frame);
  });
}
