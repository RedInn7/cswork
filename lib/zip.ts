/**
 * Just enough ZIP for the browser: read a .docx (components/resume-builder.tsx) and write an
 * export. Stored and deflated entries only, through the platform's (De)CompressionStream; no
 * ZIP64, no encryption, and a cap on what an archive may inflate to, so a zip bomb comes back null.
 */

/** Bytes through a (de)compression stream, or null past `max` output bytes. */
export async function pipeBytes(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  max: number,
) {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return concat(chunks, size);
}
function concat(chunks: Uint8Array[], size = chunks.reduce((n, c) => n + c.byteLength, 0)) {
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

let table: Uint32Array | undefined;
/** The CRC-32 every ZIP entry carries (the IEEE polynomial). */
export function crc32(bytes: Uint8Array) {
  table ??= Uint32Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  let c = ~0;
  for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

const MAX_ENTRIES = 2000;
/**
 * The entries `want` picks, by name, read through the central directory. Throws on an
 * encrypted, ZIP64, damaged or oversized archive and on a CRC mismatch; null once the picked
 * entries would inflate past `max` bytes in all.
 */
export async function unzip(bytes: Uint8Array, want: (name: string) => boolean, max: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  const lowest = Math.max(0, bytes.length - 22 - 0xffff);
  let end = bytes.length - 22;
  while (end >= lowest && u32(end) !== 0x06054b50) end--;
  if (end < lowest) throw new Error('zip: no central directory');
  const count = u16(end + 10);
  let at = u32(end + 16);
  if (count === 0xffff || at === 0xffffffff || (end >= 20 && u32(end - 20) === 0x07064b50)) throw new Error('zip: ZIP64');
  if (count > MAX_ENTRIES) throw new Error('zip: too many entries');
  const out = new Map<string, Uint8Array>();
  let budget = max;
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || u32(at) !== 0x02014b50) throw new Error('zip: damaged');
    const [flags, method, crc, packed, size] = [u16(at + 8), u16(at + 10), u32(at + 16), u32(at + 20), u32(at + 24)];
    const nameLength = u16(at + 28);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const local = u32(at + 42);
    at += 46 + nameLength + u16(at + 30) + u16(at + 32);
    if (flags & 1) throw new Error('zip: encrypted');
    if (packed === 0xffffffff || size === 0xffffffff || local === 0xffffffff) throw new Error('zip: ZIP64');
    if (!want(name)) continue;
    if (local + 30 > bytes.length || u32(local) !== 0x04034b50) throw new Error('zip: damaged');
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    if (start + packed > bytes.length) throw new Error('zip: damaged');
    const data = bytes.subarray(start, start + packed);
    if (size > budget) return null;
    let body: Uint8Array | null;
    if (method === 0) body = data;
    else if (method === 8) body = await pipeBytes(data, new DecompressionStream('deflate-raw'), budget);
    else throw new Error('zip: unsupported method');
    if (!body || body.length > budget) return null;
    if (crc32(body) !== crc) throw new Error('zip: CRC mismatch');
    budget -= body.length;
    out.set(name, body);
  }
  return out;
}

/** Little-endian fields, [byte size, value] each, as one block. */
function le(fields: [2 | 4, number][]) {
  const out = new Uint8Array(fields.reduce((n, [size]) => n + size, 0));
  const view = new DataView(out.buffer);
  let at = 0;
  for (const [size, value] of fields) {
    if (size === 2) view.setUint16(at, value, true);
    else view.setUint32(at, value, true);
    at += size;
  }
  return out;
}

/** A ZIP of these files (names flagged UTF-8), stored or deflated. */
export async function zip(files: { name: string; data: Uint8Array | string }[], deflate = false) {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const raw = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const body = deflate ? (await pipeBytes(raw, new CompressionStream('deflate-raw'), Infinity))! : raw;
    // ponytail: every entry dated 1980-01-01; real timestamps when someone needs them.
    const common: [2 | 4, number][] = [
      [2, 20], [2, 0x800], [2, deflate ? 8 : 0], [2, 0], [2, 0x21],
      [4, crc32(raw)], [4, body.length], [4, raw.length], [2, name.length], [2, 0],
    ];
    const local = le([[4, 0x04034b50], ...common]);
    central.push(le([[4, 0x02014b50], [2, 20], ...common, [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]]), name);
    parts.push(local, name, body);
    offset += local.length + name.length + body.length;
  }
  const directory = concat(central);
  const end = le([[4, 0x06054b50], [2, 0], [2, 0], [2, files.length], [2, files.length], [4, directory.length], [4, offset], [2, 0]]);
  return concat([...parts, directory, end]);
}
