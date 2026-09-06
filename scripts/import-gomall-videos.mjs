import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { chmod, copyFile, link, lstat, mkdir, open, readFile, statfs, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_VIDEO = 2 * 1024 * 1024 * 1024;
export const VIDEOS = [
  ['00','00-overview','系统全景与交易链路','1P5_xMngUcZnJ1SYjhFwV3Q_SYLzbLDo7'],
  ['01','01-user-auth','用户与鉴权 · 上','1fDeoNOu3GWkrv3vvQEp7hSIbue47b2C0'],
  ['02','01-user-auth','用户与鉴权 · 下','11sJqlttkWUEGSrBvGmxZz7qf7pbvfbdg'],
  ['03','02-payment-up','余额支付与资金事务','1IspRqjFD_7ww2umt79x5-Wv4xdZ4al2t'],
  ['04','03-payment-down','幂等、熔断与支付对账','1nEwBY2aVP7qOOhhMWp4hkMW-9F8kbPjA'],
  ['05','04-payment-clearing','清算与资金托管 · 上','14ly4lWvTeQ2SifpKfS5znLNSYqKLH0wC'],
  ['06','04-payment-clearing','清算与资金托管 · 下','1wEuEB30_c4gc0JfcDdhXtb5ZH-zL0cKH'],
  ['07','05-payment-settlement','卖家结算与退款竞争','1J6o4GvutNzOPFSM6KaqQXLbbSGOWPGNy'],
  ['08','07-product-search','商品搜索与索引同步','1uf9svJfVvoOJ-yVdUhaJq1jWiMK6FRhm'],
  ['09','08-product-search-hybrid','混合召回与搜索降级','1txwL3uuIunRoYuliVXQqsd47t9q8CGLs'],
].map(([number,lessonId,name,sourceId])=>({number,lessonId,name,sourceId,id:`gomall-video-${number}`}));

function options(argv) {
  const result={apply:false,source:null,database:process.env.DATABASE_PATH,media:process.env.MEDIA_PATH,actor:null};
  let mode=null;
  for(let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if(arg==='--help') return null;
    if(arg==='--apply'||arg==='--dry-run') {
      if(mode&&mode!==arg) throw new Error('不能同时传入 --apply 和 --dry-run');
      mode=arg;result.apply=arg==='--apply';continue;
    }
    const key={'--source':'source','--database':'database','--media':'media','--actor':'actor'}[arg];
    if(!key||!argv[i+1]||argv[i+1].startsWith('--')) throw new Error(`无效参数：${arg}`);
    result[key]=argv[++i];
  }
  if(!result.source||!result.database||!result.media) throw new Error('请设置 --source、DATABASE_PATH 和 MEDIA_PATH；后两项也可用 --database / --media');
  for(const key of ['source','database','media']) result[key]=resolve(result[key]);
  return result;
}

function payload(lesson) {
  return {title:lesson.title,summary:lesson.summary,section:lesson.section,position:lesson.position,body:lesson.body,streamUid:lesson.stream_uid||null,videoAssetIds:JSON.parse(lesson.video_asset_ids)};
}
function nextVersion(version) {
  if(!/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(version)) throw new Error(`不能自动递增非标准版本号 ${version}`);
  const parts=version.split('.').map(Number);
  for(let i=2;i>=0;i--) {
    if(parts[i]<999999){parts[i]++;for(let j=i+1;j<3;j++) parts[j]=0;return parts.join('.');}
  }
  throw new Error('课件版本已超过自动递增范围');
}
async function fileInfo(path,checkAbort) {
  const stat=await lstat(path);
  if(!stat.isFile()||stat.size<16||stat.size>MAX_VIDEO) throw new Error(`视频不是有效常规文件或超过 2 GiB：${path}`);
  const file=await open(path,'r');
  try {
    const head=Buffer.alloc(16);await file.read(head,0,16,0);
    if(head.subarray(4,8).toString()!=='ftyp') throw new Error(`视频缺少 MP4 ftyp 文件头：${path}`);
  } finally {await file.close();}
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path)) {checkAbort();hash.update(chunk);}
  return {size:stat.size,sha256:hash.digest('hex')};
}
async function exists(path) {
  try {await lstat(path);return true;} catch(e) {if(e.code==='ENOENT')return false;throw e;}
}
function actorFor(db,requested) {
  const admins=(process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  const email=(requested||admins[0]||'').toLowerCase();
  if(!admins.includes(email)) throw new Error('导入人必须明确列在 ADMIN_EMAILS 中；可用 --actor 选择');
  const user=db.prepare('SELECT id,name,email,email_verified FROM user WHERE lower(email)=?').get(email);
  if(!user?.email_verified) throw new Error('导入人必须是已有且邮箱已验证的老师账号');
  return {id:user.id,email:user.email.toLowerCase(),name:user.name,verified:true,role:'teacher'};
}
function plansFor(db,files) {
  const course=db.prepare("SELECT published FROM courses WHERE id='gomall'").get();
  if(course?.published!==1) throw new Error('GoMall 课程未开放；工具不会擅自重新上架课程');
  return [...new Set(VIDEOS.map(v=>v.lessonId))].map(id=>{
    const lesson=db.prepare('SELECT * FROM lessons WHERE id=?').get(id);
    if(!lesson||lesson.course_id!=='gomall') throw new Error(`缺少目标 GoMall 章节：${id}`);
    if(lesson.published!==1) throw new Error(`章节已下架，不能自动重新发布：${id}`);
    if(!lesson.body?.trim()) throw new Error(`章节正文为空：${id}`);
    const current=payload(lesson),target=files.filter(v=>v.lessonId===id).map(v=>v.id);
    if(current.streamUid) throw new Error(`章节已有 Stream 视频，请先由老师明确处理：${id}`);
    if(current.videoAssetIds.length&&JSON.stringify(current.videoAssetIds)!==JSON.stringify(target)) throw new Error(`章节已有其他视频或顺序不同，拒绝覆盖：${id}`);
    const draft=db.prepare('SELECT * FROM lms_lesson_drafts WHERE lesson_id=?').get(id);
    if(draft&&(draft.base_revision!==lesson.revision||JSON.stringify(JSON.parse(draft.payload_json))!==JSON.stringify(current))) throw new Error(`章节存在未发布草稿，拒绝覆盖：${id}`);
    const changed=JSON.stringify(current.videoAssetIds)!==JSON.stringify(target);
    return {id,lesson,draftRevision:draft?.revision||0,target,changed,nextVersion:changed?nextVersion(lesson.version):lesson.version};
  });
}
function validateAssets(db,files) {
  for(const v of files) {
    const existing=db.prepare('SELECT * FROM media_assets WHERE id=? OR source_id=? OR storage_key=?').all(v.id,v.sourceId,v.storageKey);
    if(existing.some(a=>a.id!==v.id||a.source_id!==v.sourceId||a.storage_key!==v.storageKey||a.size!==v.size||a.mime_type!=='video/mp4'||a.status!=='ready')) throw new Error(`素材标识或内容已被使用，拒绝覆盖：${v.id}`);
  }
}
async function videoMetadata(source) {
  const path=join(source,'metadata.json');
  if(!await exists(path))return new Map();
  const items=JSON.parse(await readFile(path,'utf8'));
  if(!Array.isArray(items)||items.length!==VIDEOS.length)throw new Error('metadata.json 必须完整包含十个视频的 ffprobe 元数据');
  const result=new Map();
  for(const item of items) {
    if(!item||!(typeof item.index==='number'||(typeof item.index==='string'&&/^\d{1,2}$/.test(item.index))))throw new Error('metadata.json 视频 index 无效');
    const index=Number(item.index);
    if(!Number.isInteger(index)||index<0||index>=VIDEOS.length||result.has(index)||!Number.isSafeInteger(item.size)||item.size<16||!Number.isFinite(item.duration)||item.duration<=0)throw new Error('metadata.json 的 index、size 或 duration 无效');
    result.set(index,item);
  }
  return result;
}

export async function importVideos(config) {
  let interrupted=false;
  const onSignal=()=>{interrupted=true;};
  const checkAbort=()=>{if(interrupted)throw new Error('导入已中断；正在回滚本次变更');};
  process.on('SIGINT',onSignal);process.on('SIGTERM',onSignal);
  let db=null,unregister=null,lock=null,lockPath=null,committed=false;
  const created=[],temporary=[];
  try {
    // Preview never opens a writable database or creates media directories.
    db=new Database(config.database,{readonly:true,fileMustExist:true});
    const actor=actorFor(db,config.actor);
    const catalog=JSON.parse(await readFile(join(root,'content/catalog.json'),'utf8'));
    if(VIDEOS.some(v=>!catalog.some(l=>l.id===v.lessonId))) throw new Error('课程目录与固定视频映射不一致');
    const metadata=await videoMetadata(config.source);
    const files=[];
    for(const v of VIDEOS) {
      checkAbort();
      const source=join(config.source,`${v.number}.mp4`);
      const info=await fileInfo(source,checkAbort);
      const measured=metadata.get(Number(v.number));
      if(measured&&measured.size!==info.size)throw new Error(`metadata.json 文件大小与真实视频不符：${v.number}.mp4`);
      const asset=db.prepare('SELECT storage_key FROM media_assets WHERE id=?').get(v.id);
      const storageKey=asset?.storage_key||`${v.id}-${info.sha256}.mp4`;
      if(basename(storageKey)!==storageKey||!/^[-a-zA-Z0-9_]+\.mp4$/.test(storageKey)) throw new Error(`素材存储路径无效：${v.id}`);
      const destination=join(config.media,storageKey),present=await exists(destination);
      if(present) {
        const saved=await fileInfo(destination,checkAbort);
        if(saved.size!==info.size||saved.sha256!==info.sha256) throw new Error(`目标文件已存在且内容不同，拒绝覆盖：${v.id}`);
      }
      files.push({...v,...info,source,destination,storageKey,present,previouslyReferenced:!!asset,duration:measured?.duration??null});
      console.log(`已校验 ${v.number}.mp4 → ${v.lessonId}，${info.size} 字节${present?'，复用相同文件':''}`);
    }
    validateAssets(db,files);
    const plans=plansFor(db,files);
    for(const p of plans)console.log(`${p.changed?'待发布':'已一致'} ${p.id}：${p.lesson.version}${p.changed?` → ${p.nextVersion}`:''}，${p.target.length} 段视频`);
    if(!config.apply) {
      console.log(`DRY RUN：10 个视频、${plans.filter(p=>p.changed).length} 个章节待更新；未写入数据库或媒体文件。`);
      return {applied:false,changed:plans.filter(p=>p.changed).length};
    }
    await mkdir(config.media,{recursive:true,mode:0o2750});
    lockPath=join(config.media,'.gomall-video-import.lock');
    try {lock=await open(lockPath,'wx',0o600);} catch(e) {
      if(e.code==='EEXIST')throw new Error(`导入锁已存在：${lockPath}；请确认没有其他导入进程，再处理遗留锁`);
      throw e;
    }
    await lock.writeFile(`pid=${process.pid}\nstarted=${new Date().toISOString()}\n`);
    const disk=await statfs(config.media,{bigint:true});
    const required=files.filter(v=>!v.present).reduce((sum,v)=>sum+BigInt(v.size),0n);
    if(disk.bavail*disk.bsize<required+3n*1024n*1024n*1024n)throw new Error('媒体复制后将不足 3 GiB 磁盘预留，拒绝导入');
    for(const v of files) {
      checkAbort();
      if(v.present)continue;
      const temp=join(config.media,`.import-${randomUUID()}.tmp`);temporary.push(temp);
      await copyFile(v.source,temp,constants.COPYFILE_EXCL);
      const copied=await fileInfo(temp,checkAbort);
      if(copied.size!==v.size||copied.sha256!==v.sha256)throw new Error(`复制期间源视频发生变化：${v.number}.mp4`);
      await chmod(temp,0o640);
      const handle=await open(temp,'r');try{await handle.sync();}finally{await handle.close();}
      // link is atomic and cannot replace an existing destination.
      try {await link(temp,v.destination);created.push({path:v.destination,previouslyReferenced:v.previouslyReferenced});} catch(e) {
        if(e.code!=='EEXIST')throw e;
        const saved=await fileInfo(v.destination,checkAbort);
        if(saved.size!==v.size||saved.sha256!==v.sha256)throw new Error(`目标文件同时被写入且内容不符：${v.id}`);
      }
      await unlink(temp);
      console.log(`已准备媒体 ${v.id}`);
    }
    const directory=await open(config.media,'r');try{await directory.sync();}finally{await directory.close();}
    // All file I/O is complete before taking the database write lock.
    db.close();db=null;
    process.env.DATABASE_PATH=config.database;
    const {register}=await import('tsx/esm/api');
    const loader=register({namespace:`gomall-video-import-${process.pid}`,tsconfig:join(root,'tsconfig.json')});unregister=loader.unregister;
    const modules=await Promise.all([loader.import('../db/sqlite.ts',import.meta.url),loader.import('../lib/server/lms-courses.ts',import.meta.url)]);
    db=modules[0].sqlite();
    const {saveLessonDraft,publishLesson}=modules[1];
    db.exec('BEGIN IMMEDIATE');
    try {
      checkAbort();
      validateAssets(db,files);
      const fresh=plansFor(db,files);
      for(let i=0;i<plans.length;i++)if(JSON.stringify(fresh[i].lesson)!==JSON.stringify(plans[i].lesson)||fresh[i].draftRevision!==plans[i].draftRevision)throw new Error(`复制期间章节已被其他人修改，请重新预览：${plans[i].id}`);
      const now=Date.now();
      for(const v of files) {
        db.prepare("INSERT OR IGNORE INTO media_assets(id,name,mime_type,size,storage_key,status,created_by,created_at,source_id,duration) VALUES(?,?,'video/mp4',?,?,'ready',?,?,?,?)").run(v.id,v.name,v.size,v.storageKey,actor.id,now,v.sourceId,v.duration);
        if(v.duration!==null)db.prepare('UPDATE media_assets SET duration=? WHERE id=? AND duration IS NULL').run(v.duration,v.id);
      }
      for(const p of fresh.filter(p=>p.changed)) {
        checkAbort();
        const saved=await saveLessonDraft(actor,p.id,{expectedRevision:p.draftRevision,...payload(p.lesson),videoAssetIds:p.target});
        await publishLesson(actor,p.id,{expectedRevision:saved.draft.revision,version:p.nextVersion,releaseTitle:`课程视频已上线：${p.lesson.title}`,releaseSummary:`本章已提供 ${p.target.length} 段课程视频，可在章节内播放并保存观看进度。`,important:false});
      }
      checkAbort();db.exec('COMMIT');committed=true;
      console.log(`APPLIED：10 个媒体资源已核验，${fresh.filter(p=>p.changed).length} 个章节发布成功；历史、审计与站内通知已一起提交。`);
      return {applied:true,changed:fresh.filter(p=>p.changed).length};
    } catch(e) {if(db.inTransaction)db.exec('ROLLBACK');throw e;}
  } finally {
    // Only this run's newly created files are candidates for rollback cleanup.
    if(!committed&&created.length) {
      for(const {path,previouslyReferenced} of created) {
        const referenced=previouslyReferenced||(db?.open&&db.prepare('SELECT id FROM media_assets WHERE storage_key=?').get(basename(path)));
        if(!referenced)await unlink(path).catch(e=>{if(e.code!=='ENOENT')console.error(`请清理本次未提交媒体：${path}`);});
      }
    }
    for(const path of temporary)await unlink(path).catch(e=>{if(e.code!=='ENOENT')console.error(`请清理临时文件：${path}`);});
    if(db?.open)db.close();
    if(unregister)await unregister();
    if(lock){await lock.close();await unlink(lockPath);}
    process.off('SIGINT',onSignal);process.off('SIGTERM',onSignal);
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const config=options(process.argv.slice(2));
    if(config)await importVideos(config);
    else console.log('node --env-file=.env scripts/import-gomall-videos.mjs --source /path/to/videos [--actor teacher@email] [--database /path/to/db] [--media /path/to/media] [--dry-run | --apply]\n默认仅预览；需要已安装依赖（包括 tsx）的源代码目录。');
  } catch(e) {console.error(`导入失败：${e.message}`);process.exitCode=1;}
}
