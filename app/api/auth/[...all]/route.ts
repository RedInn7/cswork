import { auth } from '@/lib/server/auth';
import { fail, HttpError, sameOrigin } from '@/lib/server/http';
import { setting } from '@/lib/server/env';
import { withRequestBodyCleanup } from '@/lib/server/request-lifecycle';
async function handle(request: Request) {
  if (setting('BETTER_AUTH_SECRET').length < 32)
    return fail(new HttpError(503, '登录服务正在准备中，请稍后再试'), request);
  try {
    if (request.method === 'POST') sameOrigin(request);
    return await auth().handler(request);
  } catch {
    return fail(
      new HttpError(503, '登录暂时不可用，请检查配置或稍后重试'),
      request,
    );
  }
}
const route = withRequestBodyCleanup(handle);
export const GET = route;
export const POST = route;
