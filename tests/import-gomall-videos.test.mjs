import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {VIDEOS} from '../scripts/import-gomall-videos.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function setup() {
  const dir=mkdtempSync(join(tmpdir(),'cswork-video-import-')),source=join(dir,'source'),media=join(dir,'media'),path=join(dir,'test.sqlite');
  mkdirSync(source);
  const db=new Database(path);db.pragma('foreign_keys = ON');migrate(drizzle(db),{migrationsFolder:join(root,'drizzle')});
  db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','import@example.test',1,0,0),('student','Student','learner@example.test',1,0,0)").run();
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','Keep course body','1.0.0',1)").run();
  db.prepare("INSERT INTO grants(id,email,course_id,source,created_at) VALUES('student-grant','learner@example.test','gomall','instructor',0)").run();
  for(const id of new Set(VIDEOS.map(v=>v.lessonId))) {
    db.prepare('INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,0,?,?,0)').run(id,'gomall',`Title ${id}`,'Keep summary','Keep section',`Original body ${id}`,'1.0.0');
    db.prepare('INSERT INTO revisions(id,lesson_id,version,body,created_at) VALUES(?,?,?,?,0)').run(`old-${id}`,id,'1.0.0',`Original body ${id}`);
  }
  for(const v of VIDEOS) {
    const video=Buffer.alloc(128,Number(v.number));video.writeUInt32BE(32,0);video.write('ftypisom',4);
    writeFileSync(join(source,`${v.number}.mp4`),video);
  }
  writeFileSync(join(source,'metadata.json'),JSON.stringify(VIDEOS.map(v=>({index:Number(v.number),size:128,duration:60+Number(v.number),streams:[]}))));
  db.prepare("INSERT INTO progress(user_id,lesson_id,position,note,updated_at) VALUES('student','00-overview',123,'Keep private note',0)").run();
  const run=(...args)=>spawnSync(process.execPath,['scripts/import-gomall-videos.mjs','--source',source,...args],{cwd:root,env:{...process.env,DATABASE_PATH:path,MEDIA_PATH:media,ADMIN_EMAILS:'import@example.test'},encoding:'utf8',timeout:30000});
  const count=table=>db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  const close=()=>{db.close();rmSync(dir,{recursive:true,force:true});};
  return {dir,source,media,path,db,run,count,close};
}
void test('default preview writes nothing; apply preserves lecture/history/progress; repeat is idempotent',()=>{
  const f=setup();
  try {
    const preview=f.run();assert.equal(preview.status,0,preview.stderr);assert.match(preview.stdout,/DRY RUN/);
    assert.equal(existsSync(f.media),false);assert.equal(f.count('media_assets'),0);assert.equal(f.count('releases'),0);
    const first=f.run('--apply');assert.equal(first.status,0,first.stderr);assert.match(first.stdout,/8 个章节发布成功/);
    assert.equal(f.count('media_assets'),10);assert.equal(f.count('releases'),8);assert.equal(f.count('notifications'),8);assert.equal(f.count('revisions'),16);
    assert.equal(f.db.prepare("SELECT duration FROM media_assets WHERE id='gomall-video-02'").get().duration,62);
    const lesson=f.db.prepare("SELECT * FROM lessons WHERE id='01-user-auth'").get();
    assert.equal(lesson.body,'Original body 01-user-auth');assert.equal(lesson.title,'Title 01-user-auth');assert.equal(lesson.version,'1.0.1');
    assert.deepEqual(JSON.parse(lesson.video_asset_ids),['gomall-video-01','gomall-video-02']);
    const old=JSON.parse(f.db.prepare("SELECT snapshot_json FROM revisions WHERE id='old-01-user-auth'").get().snapshot_json);
    assert.deepEqual(old.videoAssetIds,[]);assert.equal(old.body,'Original body 01-user-auth');
    const progress=f.db.prepare("SELECT * FROM progress WHERE user_id='student'").get();assert.equal(progress.position,123);assert.equal(progress.note,'Keep private note');
    const beforeAudit=f.count('audit'),beforeFiles=readdirSync(f.media);
    const repeat=f.run('--apply');assert.equal(repeat.status,0,repeat.stderr);assert.match(repeat.stdout,/0 个章节发布成功/);
    assert.equal(f.count('releases'),8);assert.equal(f.count('notifications'),8);assert.equal(f.count('audit'),beforeAudit);assert.deepEqual(readdirSync(f.media),beforeFiles);
    assert.equal(existsSync(join(f.media,'.gomall-video-import.lock')),false);
    const conflicting=readFileSync(join(f.source,'00.mp4'));conflicting[100]^=255;writeFileSync(join(f.source,'00.mp4'),conflicting);
    const refused=f.run('--apply');assert.notEqual(refused.status,0);assert.match(refused.stderr,/内容不同/);assert.equal(f.count('notifications'),8);
  } finally {f.close();}
});
void test('ffprobe metadata with inconsistent size is rejected before any file or database mutation',()=>{
  const f=setup();
  try {
    const metadata=JSON.parse(readFileSync(join(f.source,'metadata.json'),'utf8'));metadata[0].size=129;
    writeFileSync(join(f.source,'metadata.json'),JSON.stringify(metadata));
    const refused=f.run('--apply');assert.notEqual(refused.status,0);assert.match(refused.stderr,/文件大小与真实视频不符/);
    assert.equal(f.count('media_assets'),0);assert.equal(existsSync(f.media),false);
  } finally {f.close();}
});
void test('an existing unpublished draft is never overwritten and creates no media files',()=>{
  const f=setup();
  try {
    f.db.prepare("INSERT INTO lms_lesson_drafts(lesson_id,payload_json,revision,base_revision,updated_by,updated_at) VALUES('01-user-auth',?,1,1,'teacher',0)").run(JSON.stringify({title:'New unsaved title',summary:'Keep summary',section:'Keep section',position:0,body:'Private teacher draft',streamUid:null,videoAssetIds:[]}));
    const refused=f.run('--apply');assert.notEqual(refused.status,0);assert.match(refused.stderr,/未发布草稿/);
    assert.equal(f.count('media_assets'),0);assert.equal(f.count('releases'),0);assert.equal(existsSync(f.media),false);
    assert.match(f.db.prepare("SELECT payload_json FROM lms_lesson_drafts WHERE lesson_id='01-user-auth'").get().payload_json,/Private teacher draft/);
  } finally {f.close();}
});
void test('a real database failure on the second chapter rolls back earlier chapter, assets, audit and notifications',()=>{
  const f=setup();
  try {
    f.db.exec("CREATE TRIGGER fail_second_import BEFORE INSERT ON releases WHEN NEW.lesson_id='01-user-auth' BEGIN SELECT RAISE(ABORT,'forced transaction rollback'); END");
    const failed=f.run('--apply');assert.notEqual(failed.status,0);assert.match(failed.stderr,/forced transaction rollback/);
    assert.equal(f.count('media_assets'),0);assert.equal(f.count('releases'),0);assert.equal(f.count('notifications'),0);assert.equal(f.count('audit'),0);assert.equal(f.count('lms_lesson_drafts'),0);assert.equal(f.count('revisions'),8);
    assert.equal(f.db.prepare("SELECT version FROM lessons WHERE id='00-overview'").get().version,'1.0.0');
    assert.equal(f.db.prepare("SELECT snapshot_json FROM revisions WHERE id='old-00-overview'").get().snapshot_json,null);
    assert.deepEqual(readdirSync(f.media),[]);
    f.db.exec('DROP TRIGGER fail_second_import');
    const recovery=f.run('--apply');assert.equal(recovery.status,0,recovery.stderr);assert.equal(f.count('media_assets'),10);assert.equal(f.count('releases'),8);
  } finally {f.close();}
});
