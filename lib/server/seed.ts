/// <reference types="vite/client" />
import { database } from './env';
import catalog from '@/content/catalog.json';
const bodies=import.meta.glob('/content/lectures/*.md',{eager:true,query:'?raw',import:'default'}) as Record<string,string>;
export async function seed(){
 const db=database();if(await db.prepare("SELECT id FROM courses WHERE id='gomall'").first())return;
 const now=Date.now();
 await db.batch([
 db.prepare('INSERT OR IGNORE INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)').bind('gomall','GoMall 后端工程实战','以真实电商交易链路为主线，从 Go 后端基础到可靠的分布式系统。','1.0.0'),
 ...catalog.map(l=>db.prepare('INSERT OR IGNORE INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(l.id,'gomall',l.title,l.summary,l.section,l.position,bodies[`/content/lectures/${l.id}.md`]||'','1.0.0',now)),
 ...catalog.map(l=>db.prepare('INSERT OR IGNORE INTO revisions(id,lesson_id,version,body,created_at) VALUES(?,?,?,?,?)').bind(`initial:${l.id}`,l.id,'1.0.0',bodies[`/content/lectures/${l.id}.md`]||'',now)),
 db.prepare('INSERT OR IGNORE INTO releases(id,course_id,version,title,body,important,created_at) VALUES(?,?,?,?,?,?,?)').bind('initial','gomall','1.0.0','GoMall 课程讲义已开放','17 个章节的讲义已整理入库。可以阅读课件、保存笔记、提交练习与私密问题。课程视频由老师逐章发布。',1,now)
 ]);
}
