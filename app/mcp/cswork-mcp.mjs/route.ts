/// <reference types="vite/client" />
// The MCP server script, bundled at build time so /mcp's setup is a single curl.
import source from '@/tools/mcp/cswork-mcp.mjs?raw';

export function GET() {
  return new Response(source, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
