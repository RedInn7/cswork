import { auth } from '@/lib/server/auth';
import { json, sameOrigin } from '@/lib/server/http';
import { setting } from '@/lib/server/env';
async function handle(request:Request){if(setting('BETTER_AUTH_SECRET').length<32)return json({error:'登录服务正在准备中，请稍后再试'},503);try{if(request.method==='POST')sameOrigin(request);return await auth().handler(request)}catch{return json({error:'登录暂时不可用，请检查配置或稍后重试'},503)}}
export const GET=handle;export const POST=handle;
