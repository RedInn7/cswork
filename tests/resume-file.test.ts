// The builder's file import (lib/resume-file.ts, lib/zip.ts): ZIP in and out (stored and deflated,
// a bomb and an encrypted entry refused), a .docx's lists, tables, text boxes and entities as lines
// parseResumeText reads, and pdf.js text runs put back into lines (right-aligned dates, two columns).
import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, unzip, zip } from '../lib/zip';
import { PDF_SANDBOX_CSP, PDFJS_URL, docxText, pdfLines, pdfSandboxSource, readResumeFile, type PdfItem } from '../lib/resume-file';
import { parseResumeText } from '../lib/resume-parse';

const all = () => true;
const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);
const at = (bytes: Uint8Array, sig: number[]) => bytes.findIndex((_, i) => sig.every((b, k) => bytes[i + k] === b));

void test('crc32 is the IEEE check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

for (const deflate of [false, true])
  void test(`zip and unzip round-trip ${deflate ? 'deflated' : 'stored'} entries with UTF-8 names`, async () => {
    const binary = Uint8Array.from({ length: 3000 }, (_, i) => (i * 7) % 256);
    const bytes = await zip([{ name: 'notes/算法.md', data: '# 二分\nlo, hi = 0, n' }, { name: 'b.bin', data: binary }], deflate);
    assert.equal(bytes[6] & 0x08, 0, 'no data descriptor');
    assert.equal((bytes[7] << 8) & 0x800, 0x800, 'the UTF-8 flag is set');
    assert.equal(bytes[8], deflate ? 8 : 0);
    const files = await unzip(bytes, all, 1 << 20);
    assert.deepEqual([...files!.keys()], ['notes/算法.md', 'b.bin']);
    assert.equal(text(files!.get('notes/算法.md')), '# 二分\nlo, hi = 0, n');
    assert.deepEqual(files!.get('b.bin'), binary);
    const picked = await unzip(bytes, (name) => name.endsWith('.md'), 1 << 20);
    assert.deepEqual([...picked!.keys()], ['notes/算法.md']);
  });

void test('an archive that inflates past the cap is null; a broken or encrypted one throws', async () => {
  const zeros = new Uint8Array(1 << 20);
  const bomb = await zip([{ name: 'word/document.xml', data: zeros }], true);
  assert.ok(bomb.length < 5000, 'a megabyte of zeros packs small');
  assert.equal(await unzip(bomb, all, 64 * 1024), null);
  assert.equal(await unzip(await zip([{ name: 'a', data: zeros }]), all, 1000), null, 'a stored entry counts too');
  assert.ok(await unzip(bomb, (name) => name !== 'word/document.xml', 1000), 'an entry left out costs nothing');

  const plain = await zip([{ name: 'a.txt', data: 'hello' }]);
  const encrypted = plain.slice();
  encrypted[at(encrypted, [0x50, 0x4b, 0x01, 0x02]) + 8] |= 1;
  await assert.rejects(unzip(encrypted, all, 1000), /encrypted/);
  const flipped = plain.slice();
  flipped[at(flipped, [...new TextEncoder().encode('hello')])] ^= 1;
  await assert.rejects(unzip(flipped, all, 1000), /CRC/);
  const zip64 = plain.slice();
  const end = at(zip64, [0x50, 0x4b, 0x05, 0x06]);
  zip64.set([0xff, 0xff], end + 10);
  await assert.rejects(unzip(zip64, all, 1000), /ZIP64/);
  await assert.rejects(unzip(new TextEncoder().encode('PK not a zip'), all, 1000), /central directory/);
});

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
const p = (body: string, props = '') => `<w:p w:rsidR="00A1"><w:pPr>${props}<w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs></w:pPr>${body}</w:p>`;
const r = (t: string) => `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;
const list = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr>';

void test('docxText: lists get a bullet, tabs and one-paragraph cells a tab, a text box is read once, entities decode', () => {
  const xml = `<w:document ${W}><w:body>
    ${p(r('Ada ') + r('Lovelace'))}
    ${p(r('Go &amp; Rust') + '<w:r><w:br/></w:r>' + r('&lt;b&gt; &quot;x&quot; &#x4E2D;&#25991;&apos;'))}
    ${p(r('Built a cache'), list)}
    ${p(r('Wrote docs'), '<w:pStyle w:val="ListBullet"/>')}
    ${p(r('Both') + '<w:r><w:t>!</w:t></w:r>', `<w:pStyle w:val="ListParagraph"/>${list}`)}
    <w:tbl><w:tblPr/><w:tr><w:tc><w:tcPr/>${p(r('Acme'))}${p(r('Intern'))}</w:tc><w:tc>${p(r('Jun 2025 – Sep 2025'))}</w:tc></w:tr>
    <w:tr><w:tc><w:p/></w:tc><w:tc>${p(r('Remote'))}</w:tc></w:tr></w:tbl>
    ${p(r('Beta Labs') + '<w:r><w:tab/></w:r>' + r('2024') + '<w:r><w:ptab w:relativeTo="margin" w:alignment="right" w:leader="none"/></w:r>' + r('NYC'))}
    ${p(`<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><w:txbxContent>${p(r('In a box'))}</w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent>${p(r('In a box'))}</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r>`)}
    ${p('<w:del><w:r><w:delText>gone</w:delText></w:r></w:del><w:r><w:instrText> HYPERLINK "x" </w:instrText></w:r>' + r('kept'))}
    <w:sectPr/></w:body></w:document>`;
  assert.equal(
    docxText(xml),
    [
      'Ada Lovelace',
      'Go & Rust',
      `<b> "x" 中文'`,
      '• Built a cache',
      '• Wrote docs',
      '• Both!',
      'Acme',
      'Intern',
      'Jun 2025 – Sep 2025',
      '\tRemote',
      'Beta Labs\t2024\tNYC',
      'In a box',
      'kept',
    ].join('\n'),
  );
});

const item = (s: string, x: number, y: number, w: number, h = 10): PdfItem => ({ s, x, y, w, h });
void test('pdfLines: runs on a baseline join left to right, a far gap keeps two spaces for the date split', () => {
  const page = {
    w: 612,
    items: [
      item('Built a Redis cache in front of the search API, cutting p99 latency 40%', 60, 688, 420),
      item('Jun 2025 – Sep 2025', 470, 700.4, 92),
      item('Ada Lovelace', 250, 750, 110, 16),
      item('Acme Corp ', 50, 700, 62),
      item('Soft', 50, 676, 20),
      item('ware', 70, 676, 22),
      item('Engineer', 95, 676, 40),
      item('   ', 140, 676, 9),
    ],
  };
  assert.equal(
    pdfLines([page, { w: 612, items: [item('Page two', 50, 700, 40)] }, { w: 612, items: [] }]),
    'Ada Lovelace\nAcme Corp  Jun 2025 – Sep 2025\nBuilt a Redis cache in front of the search API, cutting p99 latency 40%\nSoftware Engineer\nPage two',
  );
  assert.equal(pdfLines([{ w: 612, items: [] }]), '', 'no text layer: nothing');
});

void test('pdfLines: a two-column page under a full-width name reads the left column, then the right', () => {
  const rows = (x: number, cells: (string | [string, string])[]) =>
    cells.flatMap((c, i) => (Array.isArray(c) ? [item(c[0], x, 700 - 12 * i, 55), item(c[1], 470, 700 - 12 * i, 92)] : [item(c, x, 700 - 12 * i, c.length * 5)]));
  const page = {
    w: 612,
    items: [
      item('Ada Lovelace · ada@example.com · github.com/ada', 150, 760, 300, 14),
      ...rows(40, ['EDUCATION', 'MIT', 'B.S. Computer Science', 'GPA 3.9/4.0', 'SKILLS', 'Go, Python']),
      ...rows(320, ['EXPERIENCE', ['Acme Corp', 'Jun 2025 – Sep 2025'], '• Built a cache', '• Shipped search']),
    ],
  };
  const read = pdfLines([page]);
  assert.equal(
    read,
    'Ada Lovelace · ada@example.com · github.com/ada\nEDUCATION\nMIT\nB.S. Computer Science\nGPA 3.9/4.0\nSKILLS\nGo, Python\nEXPERIENCE\nAcme Corp  Jun 2025 – Sep 2025\n• Built a cache\n• Shipped search',
  );
  const parsed = parseResumeText(read);
  assert.deepEqual(parsed.experience, [{ title: 'Acme Corp', subtitle: '', dates: 'Jun 2025 – Sep 2025', bullets: 'Built a cache\nShipped search' }]);
  assert.equal(parsed.education[0].title, 'MIT');
  // A sidebar layout: the gutter sits left of centre, under a narrow centred name and contact line.
  const sidebar = {
    w: 612,
    items: [
      item('Grace Hopper', 250, 760, 112, 18),
      item('grace@example.com | New York, NY', 210, 742, 192, 9),
      ...rows(40, ['EDUCATION', 'Yale University', 'Ph.D. Mathematics', 'SKILLS', 'COBOL, Assembly']).map((i) => ({ ...i, y: i.y - 3 })),
      ...rows(250, ['EXPERIENCE', ['Remington Rand', '1949 – 1971'], '• Built the A-0 compiler', '• Wrote the FLOW-MATIC manual']),
    ],
  };
  assert.equal(
    pdfLines([sidebar]),
    'Grace Hopper\ngrace@example.com | New York, NY\nEDUCATION\nYale University\nPh.D. Mathematics\nSKILLS\nCOBOL, Assembly\nEXPERIENCE\nRemington Rand  1949 – 1971\n• Built the A-0 compiler\n• Wrote the FLOW-MATIC manual',
  );
  // The contact lines at the top of the sidebar, its email the widest: they are column rows, not a header.
  const contacts = {
    w: 612,
    items: [
      ...rows(40, ['Ada Lovelace', 'Seattle, WA', '(555) 123-4567', 'ada.lovelace@example.com', 'EDUCATION', 'MIT', 'SKILLS', 'Go, Python']).map((i) => (i.s.includes('@') ? { ...i, w: 190 } : i)),
      ...rows(240, ['', '', 'EXPERIENCE', ['Acme Corp', 'Jun 2025 – Sep 2025'], '• Built a Redis cache in front of the search API, cutting p99 latency 40%']).filter((i) => i.s),
    ].map((i) => (i.s.startsWith('•') ? { ...i, w: 330 } : i)),
  };
  const sidebarTop = pdfLines([contacts]);
  assert.equal(
    sidebarTop,
    'Ada Lovelace\nSeattle, WA\n(555) 123-4567\nada.lovelace@example.com\nEDUCATION\nMIT\nSKILLS\nGo, Python\nEXPERIENCE\nAcme Corp  Jun 2025 – Sep 2025\n• Built a Redis cache in front of the search API, cutting p99 latency 40%',
  );
  assert.deepEqual(parseResumeText(sidebarTop).experience, [
    { title: 'Acme Corp', subtitle: '', dates: 'Jun 2025 – Sep 2025', bullets: 'Built a Redis cache in front of the search API, cutting p99 latency 40%' },
  ]);
  // One column: a bullet crosses the middle, so the same rows stay as lines.
  const single = { w: 612, items: [...rows(40, ['EDUCATION', 'MIT']), item('Built a cache across the whole width of the page', 40, 650, 500)] };
  assert.equal(pdfLines([single]), 'EDUCATION\nMIT\nBuilt a cache across the whole width of the page');
  // One column whose bullets all stop short of the right-aligned dates: the strip is there, but the
  // dates are too little text to be a column (what pdf.js read from a real PDF before this check).
  const short = {
    w: 612,
    items: [
      item('Ada Lovelace', 72, 720, 95, 16),
      item('EXPERIENCE', 72, 680, 60),
      ...rows(72, [['Acme Corp', 'Jun 2025 – Sep 2025'], 'Software Engineer Intern', '• Built a Redis cache in front of the search API', '• Cut p99 latency 40%']).map((i) => ({ ...i, y: i.y - 34 })),
      item('EDUCATION', 72, 610, 55),
      item('MIT', 72, 596, 20),
      item('2022 – 2026', 470, 596, 55),
    ],
  };
  assert.equal(
    pdfLines([short]),
    'Ada Lovelace\nEXPERIENCE\nAcme Corp  Jun 2025 – Sep 2025\nSoftware Engineer Intern\n• Built a Redis cache in front of the search API\n• Cut p99 latency 40%\nEDUCATION\nMIT  2022 – 2026',
  );
});

const docx = (body: string) =>
  zip(
    [
      { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}</w:body></w:document>` },
    ],
    true,
  );

void test('readResumeFile: a .docx made by Word comes out as entries parseResumeText fills the builder with', async () => {
  const bytes = await docx(
    [
      p(r('Ada Lovelace'), '<w:pStyle w:val="Title"/>'),
      p(r('ada@example.com | (555) 123-4567 | Seattle, WA')),
      p(r('EXPERIENCE'), '<w:pStyle w:val="Heading1"/>'),
      `<w:tbl><w:tr><w:tc>${p(r('Acme Corp'))}${p(r('Software Engineer Intern'))}</w:tc><w:tc>${p(r('Jun 2025 – Sep 2025'))}</w:tc></w:tr></w:tbl>`,
      p(r('Built a Redis cache &amp; cut p99 latency 40%'), list),
      p(r('Shipped search'), list),
      p(r('Beta Labs') + '<w:r><w:tab/></w:r>' + r('Jan 2024 – Present')),
      p(r('Research Assistant')),
      p(r('Trained ranking models'), list),
      p(r('EDUCATION')),
      p(r('University of Washington') + '<w:r><w:tab/></w:r>' + r('Sep 2022 – Jun 2026')),
      p(r('B.S. Computer Science')),
    ].join(''),
  );
  const read = await readResumeFile(new Blob([bytes as BlobPart]));
  const resume = parseResumeText(read);
  assert.equal(resume.name, 'Ada Lovelace');
  assert.equal(resume.email, 'ada@example.com');
  assert.equal(resume.location, 'Seattle, WA');
  assert.deepEqual(resume.experience, [
    { title: 'Acme Corp', subtitle: 'Software Engineer Intern', dates: 'Jun 2025 – Sep 2025', bullets: 'Built a Redis cache & cut p99 latency 40%\nShipped search' },
    { title: 'Beta Labs', subtitle: 'Research Assistant', dates: 'Jan 2024 – Present', bullets: 'Trained ranking models' },
  ]);
  assert.deepEqual(resume.education, [{ title: 'University of Washington', subtitle: 'B.S. Computer Science', dates: 'Sep 2022 – Jun 2026', bullets: '' }]);

  const long = await readResumeFile(new Blob([(await docx(p(r('x'.repeat(30_000))))) as BlobPart]));
  assert.equal(long.length, 20_000, 'cut to what the paste box holds');
});

void test('readResumeFile: a layout table keeps each cell\'s lines; a header in cells or behind tabs still splits', async () => {
  const tc = (...paras: string[]) => `<w:tc><w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>${paras.map((t) => p(r(t))).join('')}</w:tc>`;
  const bytes = await docx(
    [
      `<w:tbl><w:tr>${tc('Ada Lovelace')}${tc('ada@example.com', '(555) 123-4567')}</w:tr></w:tbl>`,
      p(r('Seattle, WA') + '<w:r><w:tab/></w:r>' + r('github.com/ada')),
      `<w:tbl><w:tr>${tc('SKILLS', 'Go, Python')}${tc('EXPERIENCE', 'Acme Corp', 'Jun 2025 – Sep 2025')}</w:tr></w:tbl>`,
    ].join(''),
  );
  const read = await readResumeFile(new Blob([bytes as BlobPart]));
  assert.equal(read, 'Ada Lovelace\tada@example.com\n(555) 123-4567\nSeattle, WA\tgithub.com/ada\nSKILLS\nGo, Python\nEXPERIENCE\nAcme Corp\nJun 2025 – Sep 2025');
  const resume = parseResumeText(read);
  assert.deepEqual(
    [resume.name, resume.email, resume.phone, resume.location, resume.links, resume.skills],
    ['Ada Lovelace', 'ada@example.com', '(555) 123-4567', 'Seattle, WA', 'github.com/ada', 'Go, Python'],
  );
  assert.deepEqual(resume.experience, [{ title: 'Acme Corp', subtitle: '', dates: 'Jun 2025 – Sep 2025', bullets: '' }]);
  // Contact details set apart by tab stops.
  const tabbed = parseResumeText('Ada Lovelace\nSeattle, WA\t(555) 123-4567\tada@example.com\nEXPERIENCE\nAcme Corp');
  assert.deepEqual([tabbed.name, tabbed.email, tabbed.phone, tabbed.location], ['Ada Lovelace', 'ada@example.com', '(555) 123-4567', 'Seattle, WA']);
});

void test('readResumeFile: refuses big files, other formats and a zip with no Word document', async () => {
  const code = (blob: Blob) => readResumeFile(blob).then(() => 'read', (e: Error) => e.message);
  assert.equal(await code(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)])), 'too-big');
  assert.equal(await code(new Blob(['{\\rtf1 Ada}'])), 'type');
  assert.equal(await code(new Blob([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1])])), 'type', 'an old .doc');
  assert.equal(await code(new Blob([(await zip([{ name: 'content.xml', data: '<office/>' }])) as BlobPart])), 'docx', 'an .odt');
  assert.equal(await code(new Blob([(await docx(p('<w:r><w:drawing/></w:r>'))) as BlobPart])), 'docx', 'no text');
  const bomb = await zip([{ name: 'word/document.xml', data: new Uint8Array(40 * 1024 * 1024) }], true);
  assert.equal(await code(new Blob([bomb as BlobPart])), 'docx', 'a bomb');
});

void test('the PDF sandbox page: pinned pdf.js behind its own CSP, eval and font loading off, four pages', () => {
  const page = pdfSandboxSource();
  assert.equal(PDFJS_URL, 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/');
  assert.ok(page.startsWith(`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PDF_SANDBOX_CSP}">`));
  assert.match(PDF_SANDBOX_CSP, /^default-src 'none'; /);
  assert.ok(!PDF_SANDBOX_CSP.includes("'unsafe-eval'"));
  for (const directive of ['script-src', 'worker-src', 'connect-src'])
    assert.ok(new RegExp(`${directive} [^;]*${PDFJS_URL.replace(/[.]/g, '\\.')}`).test(PDF_SANDBOX_CSP), directive);
  for (const part of ['isEvalSupported: false', 'disableFontFace: true', 'cMapPacked: true', 'base + "cmaps/"', 'Math.min(doc.numPages, 4)', 'event.source !== parent'])
    assert.ok(page.includes(part), part);
});
