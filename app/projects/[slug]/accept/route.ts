import { resumeProject } from '@/lib/server/resume-projects';

const RETIRED = true;

/** /projects/<slug>/accept: the project's acceptance script as a download. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const project = resumeProject((await context.params).slug);
  // Resume projects are taken down (app/projects/layout.tsx).
  if (!project || RETIRED) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(project.accept, {
    headers: {
      'Content-Type': 'text/x-python; charset=utf-8',
      'Content-Disposition': 'attachment; filename="accept_test.py"',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
