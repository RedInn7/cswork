/// <reference types="vite/client" />
// The MCP server script, bundled at build time (as lib/server/seed.ts bundles lectures)
// so /mcp's setup is a single curl.
const file = '/tools/mcp/cswork-mcp.mjs';
const source = import.meta.glob('/tools/mcp/cswork-mcp.mjs', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export function GET() {
  return new Response(source[file], {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
