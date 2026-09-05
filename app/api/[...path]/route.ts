import { handle } from '@/lib/server/api';
import { withRequestBodyCleanup } from '@/lib/server/request-lifecycle';
const route = withRequestBodyCleanup(handle);
export const GET = route;
export const POST = route;
