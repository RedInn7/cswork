#!/usr/bin/env python3
"""Shared freeze steps for the 2026-10-08 source-image recovered batch (b2).

Each per-problem generator supplies the problem-specific parts (reference, oracle,
cases, mutants, statement); this module performs exactly the same source binding,
native execution, negative-control and artifact-writing steps as
amazon_336_recovered.py / zolostays_2_recovered.py.
"""
from pathlib import Path
import hashlib,json,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
IMAGES_DOC=ROOT/'docs/oa-recovery/source-images-20261008.json'
MAX_CASE=32*1024*1024;MAX_OUT=64*1024*1024;MAX_PKG=99614720;MAX_PUBLIC=32*1024
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def source(pid,path):
 raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT)
 blob=subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()
 item=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==pid)
 images=[]
 for im in next(x for x in json.loads(IMAGES_DOC.read_text()) if x['id']==pid)['images']:
  assert sha((ROOT/im['path']).read_bytes())==im['sha256'],im['path'];images.append(im)
 return {'raw':raw,'rawSha':sha(raw),'blob':blob,'hash':item['contentHash'],'url':item['sourceUrl'],'images':images}
def compile_program(code,lang,tmp,name):
 if lang=='cpp':
  src=tmp/f'{name}.cpp';src.write_text(code);out=tmp/name
  subprocess.run(['c++','-std=c++20','-O2',str(src),'-o',str(out)],check=True);return [str(out)]
 src=tmp/f'{name}.py';src.write_text(code);return ['python3','-I',str(src)]
def execute(cmd,raw,timeout=20):
 start=time.perf_counter();p=subprocess.run(cmd,input=raw,text=True,capture_output=True,check=True,timeout=timeout);assert not p.stderr,p.stderr[:500]
 return p.stdout,round(time.perf_counter()-start,5)
def same(a,b,checker):return a.split()==b.split() if checker=='tokens' else a==b
def freeze(S):
 """S: dict with pid,batch,seed,path,reference,lang,mutants,editorial,editorialTitle,problem,
 oracles,cases,exhaustive(cmd)->(count,desc),oracleMethod,imageProvenance,rangeDisclosure,corrections,reason,largePrefix"""
 started=time.perf_counter();pid=S['pid'];batch=S['batch'];src=source(pid,S['path'])
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==pid)
 cases=S['cases'];oracles=S['oracles'];checker=S['problem']['checker'];ext='cpp' if S['lang']=='cpp' else 'py'
 assert 35<=len(cases)<=64,len(cases);assert len(oracles)>=160
 keys={o['input'] for o in oracles};assert len(keys)==len(oracles),'duplicate oracle input'
 assert len({c['input'] for c in cases})==len(cases),'duplicate formal input'
 pub=[c for c in cases if not c['hidden']];assert len(pub)==3 and all(not c['hidden'] for c in cases[:3])
 for c in pub:assert len(c['input'].encode())<=MAX_PUBLIC and len(c['expectedOutput'].encode())<=MAX_PUBLIC
 for c in cases:assert len(c['input'].encode())<=MAX_CASE and len(c['expectedOutput'].encode())<=MAX_OUT,c['name']
 ref=OA/f'references/{pid}.{ext}';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(S['reference'])
 print(f"{pid} prepared {len(cases)} formal, {len(oracles)} oracle; testing native programs",flush=True)
 large=[]
 with tempfile.TemporaryDirectory(prefix=batch+'-') as tmp:
  tmp=Path(tmp);cmd=compile_program(S['reference'],S['lang'],tmp,'reference')
  exhaustive,exdesc=S['exhaustive'](lambda raw:execute(cmd,raw)[0])
  for o in oracles:assert same(execute(cmd,o['input'])[0],o['expectedOutput'],checker),o['input'][:200]
  for c in cases:
   actual,el=execute(cmd,c['input']);assert same(actual,c['expectedOutput'],checker),c['name']
   if c['name'].startswith(S['largePrefix']):large.append({'name':c['name'],'inputBytes':len(c['input']),'outputBytes':len(c['expectedOutput']),'elapsedSeconds':el})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,m in enumerate(S['mutants']):
   mext='cpp' if m['language']=='cpp' else 'py'
   p=OA/f'negative-controls/{pid}-{i+1}.{mext}';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(m['code'])
   mc=compile_program(m['code'],m['language'],tmp,f'mutant{i}');rejected=[]
   for j,c in enumerate(cases):
    if not same(execute(mc,c['input'])[0],c['expectedOutput'],checker):rejected.append(j)
   assert rejected,m['name'];kills.append({'name':m['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
  assert len(kills)>=3
  for stale in (OA/'negative-controls').glob(f'{pid}-*'):
   if stale.stem.rsplit('-',1)[1].isdigit() and int(stale.stem.rsplit('-',1)[1])>len(S['mutants']):stale.unlink()
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':S['problem'],'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 solutions=[{'language':'cpp' if S['lang']=='cpp' else 'python','code':S['reference']}]
 put('packages',pid+'.json',json.loads(normalized));put('oracles',pid+'.json',oracles);put('mutants',pid+'.json',S['mutants'])
 assert (OA/'packages'/(pid+'.json')).stat().st_size<=MAX_PKG,'package over 95MB'
 put('editorials',pid+'.json',{'schemaVersion':1,'id':pid,'title':S['editorialTitle'],'explanation':S['editorial'],'solutions':solutions})
 put('candidate-batches',batch+'.json',{'schemaVersion':1,'items':[{'id':pid,'sourceContentHash':src['hash'],'packageChecksum':sha(normalized),'editorial':S['editorial'],'authoredSolutions':solutions}]})
 put('source-evidence',batch+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{pid:{'contentHash':src['hash'],'catalogContentHash':src['hash'],'sourceUrl':src['url'],'sources':[{'path':S['path'],'gitBlobSha':src['blob'],'rawSha256':src['rawSha']}],'upstreamCodeExecuted':False,
  'sourceImages':[{'path':im['path'],'sha256':im['sha256'],'url':im['url']} for im in src['images']],
  'imageProvenance':S['imageProvenance'],'rangeDisclosure':S['rangeDisclosure'],'corrections':S['corrections']}}})
 put('resolutions',batch+'.json',{'schemaVersion':1,'items':[{'id':pid,'sourceContentHash':src['hash'],'batch':batch,'previousReason':old.get('reason',''),'reason':S['reason']}]})
 put('validation',batch+'.json',{'schemaVersion':1,'seed':S['seed'],'problems':[{'id':pid,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':S['lang'],'referenceSha256':sha(S['reference']),'negativeControls':kills,'oracleMethod':S['oracleMethod'],'exhaustiveSmallDomain':dict(exdesc,cases=exhaustive),'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f"{pid} frozen: {len(cases)} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} bytes={len(normalized.encode())}",flush=True)
def case(name,inp,out,hidden=True):return {'name':name,'input':inp,'expectedOutput':out,'hidden':hidden,'weight':1}
def problem(pid,title,difficulty,tags,description,inp,output,explanation,hints,timeLimit=2,memoryLimit=262144,outputLimit=1024,checker='tokens'):
 return {'id':pid,'courseId':'gomall','lessonId':'00-overview','title':title,'difficulty':difficulty,'tags':tags,'description':description,'input':inp,'output':output,'explanation':explanation,'hints':hints,'timeLimit':timeLimit,'memoryLimit':memoryLimit,'outputLimit':outputLimit,'checker':checker,'languages':['python','go','java','cpp']}
IMAGE_PROVENANCE='Publicly readable FastPrep Problem Source image(s) linked from the original page, retrieved separately and personally viewed during packaging. Not immutable assets of the fixed upstream commit; bound here by sha256.'
