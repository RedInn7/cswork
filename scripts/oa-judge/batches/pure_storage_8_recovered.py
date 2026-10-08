#!/usr/bin/env python3
"""One no-input witness task; never invent hidden inputs or sample counts."""
from pathlib import Path
import hashlib,json,subprocess,sys,time

ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-pure-storage-8';BATCH='pure-storage-8-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='7d588c12ac66d8b7443ccbb11fb2d280f857a7ae81dad6642e3b1eddf2921743'
SOURCES=[
 ('OA LIST/Pure_Storage_OA/019_image.txt','7da07624576f0cb8fc11463f9c6b12ed7405e0a1','b41c86d4c22af2262747f9e3713c16081b47e44e46047f4618f32db8dbd97dc5'),
 ('OA LIST/Pure_Storage_OA/052_QQ_1743882880637.txt','41842c699a44f01bcfe2f6bc7c5755dee32de614','0f843448173dde0b1570698fac0a9ab648b1d6bad23a1b2dc933541800097d7e'),
 ('OA LIST/Pure_Storage_OA/053_QQ_1743882950907.txt','8f68e82ad17ec6b1cf8fb762c52d4df4b485ca77','29e6ce8108fabcca736f00faa8d1bac63474b89c3622e36021fe44cc885d80aa'),
 ('OA LIST/Pure_Storage_OA/054_QQ_1743882981297.txt','b3e9c0d3587883a1f5d0f5726b0a660fc7ee7d5c','924a156d28d65728a9c001eef767e4f6e37d7eabf4ad26f2048b1486c6075b3a'),
]
EXPECTED='3\n1 2 3\n2\n'
REFERENCE="print('3')\nprint('1 2 3')\nprint('2')\n"
MUTANTS=[{'name':'错误声称算法正确','code':"print('CORRECT')\n"},
 {'name':'输出实际能够命中的target3而非反例','code':"print('3')\nprint('1 2 3')\nprint('3')\n"}]
JAVA='''int sorted_search(int[] elements, int target) {
    if (elements == null || elements.length <= 0) return -1;
    int left = 0, right = elements.length - 1;
    while (left < right) {
        int middle = (left + right + 1) / 2;
        if (elements[middle] > target) right = middle - 1;
        else left = middle + 1;
    }
    if (elements[right] == target) return right;
    return -1;
}'''
EDITORIAL='''## 原始任务与本站序列化

固定提交e66f809f4c953bce129f68491726176615db6afc的Pure_Storage_OA/019和052–054原OCR要求编写一个无输入程序：若给定二分查找正确，输出CORRECT；否则恰好三行输出有序数组长度、数组元素、目标值，作为错误结果的见证。本站保留无输入任务，不增加随机参数或重复空输入伪造隐藏覆盖。采用053完整Java版本作为被反驳程序，以明确int的32位有符号语义；原Python片段的/不按Python3浮点下标解释，原文明确各版本算法相同。

原文没有独立数值约束表。数组元素和target取Java int可表示范围−2147483648..2147483647，这是被反驳接口的类型范围，不伪称OCR给过额外上下限。有序指非递减，可以重复。反例长度不另限为小常数，实际输出受本站公开运行输出预算约束；长度必须和第二行元素数量一致。返回重复值的任意一个正确下标都算正确，不要求第一个或最后一个。

本站展示的3/[1,2,3]/2是推导见证，不是原OCR提供的样例；原OCR只有要求，没有该具体反例。参考程序固定输出一个正确见证正是无输入构造任务所要求的程序，不是用硬编码替代输入算法。评测器接受任何合法有效反例，而非只接受参考字符串。

## 思路

取数组[1,2,3]与target=2。初始left=0、right=2，middle=1；数组中间值等于target，但错误程序没有返回，而是执行left=middle+1=2。循环终止，只检查elements[right]=3，不等于2，因此返回−1。

## 正确性证明

数组[1,2,3]非递减，元素和target均为合法Java int。target=2实际位于下标1，因此正确搜索不应返回−1。上述逐步执行表明给定程序确实返回−1，所以这三个输出行构成有效反例，证伪算法的普遍正确性；CORRECT不是合法答案。

数组[1,2,3]与target=3不是反例：相同第一次迭代后，最后检查下标2得到3并返回2，该返回正确。它和错误CORRECT分别作为两个正常退出负控。相同数组target=1也能正确返回0，不能把所有已有目标或所有长度3数组都视为反例。

## 复杂度与整数语义

构造程序输出固定三个数，时间和额外空间均O(1)。语义判题需要O(n)检查有序性、元素数量和真实目标存在性，再用O(log n)模拟给定算法，不能对返回的非−1下标要求固定匹配位置。

原Java中点表达式理论上可能32位加法溢出，但在本站64KiB输出预算内，文本数组至多约32768个整数，中点加法远低于2^31；不存在借整数溢出或非法内存访问构造假反例的问题。元素与target没有算术运算，只做比较。空数组使原函数返回−1，目标不可能存在，所以不能成为有效反例。输出CORRECT、非有序数组、数值超Java int、声明长度不符、实际能正确搜索的输入均应拒绝。

## 独立验证范围

输入域恰好只有空字符串，oracleCoverage明确exhaustive inputs:[空字符串]，仅一个公开正式案例，不伪造20个隐藏输入或163个不同输入。作者本地真实启动原创参考及两个负控进程，确认其正常退出和输出；反例正确性由手工执行轨迹与真实成员关系独立证明。完整语义checker的丰富正反见证测试另由独立模块负责，作者不以参考输出相等充当通用见证验证。
'''

def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def run(path):
 p=subprocess.run([sys.executable,'-I',str(path)],input='',text=True,capture_output=True,timeout=3,check=True)
 assert not p.stderr
 return p.stdout
def main():
 start=time.perf_counter();evidence=[]
 for path,blob,h in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT)
  assert sha(raw)==h
  assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==blob
  evidence.append({'path':path,'gitBlobSha':blob,'rawSha256':h})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 path=OA/f'references/{PID}.py';path.write_text(REFERENCE);assert run(path)==EXPECTED
 kills=[]
 for i,m in enumerate(MUTANTS,1):
  p=OA/f'negative-controls/{PID}-{i}.py';p.write_text(m['code']);actual=run(p)
  assert actual==('CORRECT\n' if i==1 else '3\n1 2 3\n3\n')
  kills.append({'name':m['name'],'rejectedByCases':[0],'normalExitVerified':True,'authorReason':'Algorithm has a concrete false negative' if i==1 else 'Target3 is correctly returned at index2; this is not a counterexample','localSemanticProof':'explicit trace, not reference-output comparison'})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'为错误二分查找构造反例','difficulty':'简单','tags':['OA','Pure Storage','构造','二分查找'],
 'description':'Bob声称下列程序总能在非递减数组中正确搜索target：存在时返回任意匹配下标，不存在时返回−1。请编写无输入程序，若算法正确则输出CORRECT，否则输出任意合法反例数组与target。本站按原OCR053完整Java版本解释，被反驳程序为：\n\n```java\n'+JAVA+'\n```\n\n评测接受任意能使该算法得到错误结果的合法见证，不要求与你看到的公开示例相同。',
 'input':'无输入，标准输入为空。不要读取题目中不存在的测试参数。',
 'output':'若程序正确，输出CORRECT。否则恰好三行：第一行非负整数n；第二行恰好n个空格分隔的整数，以非递减顺序排列；第三行target。元素和target必须是Java有符号32位整数（−2147483648..2147483647），由原int接口确定；原文没有另给数组长度上限，本站不加人为小长度限制，输出总量受64KiB运行预算约束。见证必须让原程序返回错误结果；若target重复，返回任意匹配下标均是正确结果，不能作为反例。',
 'explanation':'公开输出为本站推导而非原OCR样例。数组[1,2,3]搜索2时，middle=1且elements[1]=2，却执行left=2；循环退出检查elements[2]=3，错误返回−1。故这三行是合法反例，CORRECT不成立。原OCR要求反例三行且没有输入，本题不伪造额外输入。',
 'hints':['检查中间元素恰好等于target时的分支。','构造一个很小的有序数组即可证伪普遍正确性。'],'timeLimit':1,'memoryLimit':65536,'outputLimit':64,'checker':'oa-binary-search-witness','languages':['python','go','java','cpp']}
 package={'schemaVersion':1,'problem':problem,'cases':[{'name':'本站构造见证（唯一空输入）','input':'','expectedOutput':EXPECTED,'hidden':False,'weight':1}]}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 p=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True)
 if p.returncode:raise RuntimeError('Shared checker schema not ready; no candidate JSON written. '+p.stderr[-1600:])
 normalized=p.stdout;solutions=[{'language':'python','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',[{'input':'','expectedOutput':EXPECTED}]);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'中间值相等却被跳过的反例','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions,'oracleCoverage':{'mode':'exhaustive','inputs':['']}}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'catalogContentHash':HASH,'contentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':evidence,'upstreamCodeExecuted':False,'authorInterpretations':['Original task has no input and requests CORRECT or exactly3 lines of a witness.','Choose complete Java int32 algorithm, not Python3 float-index interpretation. No numeric constraint table is claimed.','Nondecreasing order, duplicates allowed; any matching returned index is correct.','Public witness is site-derived, not an original source example. Runtime64KiB output budget is disclosed, not falsely labelled original array-size constraint.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'原OCR完整要求无输入反例程序；固定ID语义checker可验证任意反例而不是tokens拒绝多解。唯一空输入穷尽覆盖，原Java类型与本站输出预算明确披露，不伪造隐藏输入。候选待独立checker与沙箱验收。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'problems':[{'id':PID,'oracleCases':1,'uniqueOracleInputs':1,'oracleCoverage':{'mode':'exhaustive','inputs':['']},'publicCases':1,'hiddenCases':0,'referenceFormalCases':1,'referenceSha256':sha(REFERENCE),'negativeControls':kills,'localReferenceSubprocess':True,'normalExitChecked':True,'oracleMethod':'Exhaustive singleton input domain; witness proven by explicit trace: (left,right,middle)=(0,2,1), then left2,right2, final element3 differs from target2 which exists at index1.','checkerValidation':'Separate independently authored semantic checker tests are required; local author traces do not substitute for them.','localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
 print('PureStorage8 frozen:one public empty-input case,exhaustive singleton oracle,reference+2 mutants normal-exit subprocess checked',flush=True)
if __name__=='__main__':main()
