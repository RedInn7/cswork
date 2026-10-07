#!/usr/bin/env python3
"""Generate source-recovered Goldman Sachs 2 as an offline-only candidate."""
from pathlib import Path
from itertools import groupby
import hashlib
import json
import random
import re
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-goldman-sachs-2'
BATCH='goldman-sachs-2-recovered'
SEED=20261007
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
RAW_PATH='fastprep/Goldman Sachs/better-compression.md'
RAW_BLOB='59e4aea38202ef0d7ae90c017069ee498b36192c'
HASH='6e154e3e133faa403e271731ba16ed4dc135082635df8583f70f5eccb5e0171a'
URL='https://oamaster.com/docs/companies/goldman-sachs#2-better-compression'
PREVIOUS='约束文本损坏（字符/频次约束无法可靠恢复），不擅自补全原始输入范围。'

REFERENCE='''import sys

def solve(raw):
    s = raw.strip()
    counts = [0] * 26
    i = 0
    while i < len(s):
        letter = ord(s[i]) - ord('a')
        i += 1
        frequency = 0
        while i < len(s) and '0' <= s[i] <= '9':
            frequency = frequency * 10 + ord(s[i]) - ord('0')
            i += 1
        counts[letter] += frequency
    return ''.join(chr(ord('a') + j) + str(counts[j]) for j in range(26) if counts[j])

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS=[
    {'name':'相同字母后段覆盖前段而非累加',
     'code':REFERENCE.replace('counts[letter] += frequency','counts[letter] = frequency')},
    {'name':'按字母降序输出而非升序',
     'code':REFERENCE.replace('for j in range(26) if counts[j]', 'for j in range(25, -1, -1) if counts[j]')},
]

EDITORIAL='''## 原始来源与输入约定

固定提交 e66f809f4c953bce129f68491726176615db6afc 中 fastprep/Goldman Sachs/better-compression.md 保留完整约束：1≤|S|≤100000；每段字母为a到z；每段频次数值为1到1000。catalog经HTML剥除后的前两条被截断，本站直接核对原始文件恢复，不执行或照搬其题解。

字符串保证由一个或多个“一个小写字母＋至少一位十进制数字”组成。虽然给出的长度下界为1，有效编码最短为2字符，因此不存在需要猜测如何处理的单字符输入。每段频次1..1000不限制合并后的总频次；总频次可以大于1000。原文未禁止数字前导零，本站兼容它们，不新增“必须规范数字串”的限制。输出的十进制数不带前导零。标准输入一行S（不含引号）及输出一行结果由本站整理。

## 算法

从左到右读取字母，再逐位读取其后连续数字，以frequency=frequency×10+digit更新该段次数。将次数加入26个字母桶。扫描结束后按a到z遍历非零桶，输出字母及总次数。

## 正确性证明

循环不变量：已读完所有完整段的每个字母总次数准确存于对应桶中；读下一段时逐位十进制递推得到该段次数，再相加，保持不变量。扫描结束后所有段均恰好累计一次。最后按a到z遍历非零桶，每个字母只输出一次并附总次数，满足合并重复字母且字典序排列的要求。

不要对整段数字串直接调用int：合法频次可以写成很多前导零加1，数字串长度可超过Python的4300位默认转换限制。逐位解析不会遇到此限制；合法频次始终不超过1000，前导零也不产生大整数。

## 复杂度与边界

O(|S|+26)时间、26桶为O(1)额外计算空间（输入字符串本身O(|S|)）。最多50000段，每段不超过1000，所有频次和至多50000000，32位有符号整数足够；该值是安全上界，不声称每种段长都能同时达到它。输出至多26个字母及每个最多8位数字，即234字符，加换行至多235字节。题包outputLimit的单位为KiB，配置4 KiB即4096字节，足以覆盖完整输入域的正确输出。

## 独立验证

小输入oracle用正则分段，把各段真实展开为字符列表，再排序并按连续相同字符重新编码，不使用参考程序的26桶累加方法。163个唯一输入均经真实Python子进程对拍。完整长度边界含100000字符、50000段、次数1000、所有26字母、合并次数24975000，以及99999位数字（前导零）的合法输入。大边界以构造公式给出期望值，不展开数千万字符。覆盖覆写频次和错误降序输出的两个负控均正常退出并被正式用例拒绝。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()


def put(folder,name,value):
    path=OA/folder/name
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def expanded_oracle(s):
    expanded=[]
    groups=re.findall(r'([a-z])([0-9]+)',s)
    assert ''.join(c+d for c,d in groups)==s
    for c,digits in groups:
        # Small oracles only: independently decode then truly expand characters.
        value=int(digits)
        assert 1<=value<=1000
        expanded.extend(c*value)
    expanded.sort()
    return ''.join(c+str(sum(1 for _ in group)) for c,group in groupby(expanded))


def run(path,s):
    result=subprocess.run([sys.executable,'-I',str(path)],input=s+'\n',text=True,
        capture_output=True,check=True,timeout=12)
    assert not result.stderr,result.stderr
    return result.stdout.strip()


def main():
    started=time.perf_counter()
    catalog=json.loads((ROOT/'content/oa-master/catalog.json').read_text())
    source=next(x for x in catalog['items'] if x['id']==PID)
    assert source['contentHash']==HASH and source['sourceUrl']==URL
    reviews=json.loads((OA/'reviews/goldman-sachs-next.json').read_text())
    old=next(x for x in reviews['items'] if x['id']==PID)
    assert old['status']=='blocked' and old['reason']==PREVIOUS
    raw=subprocess.check_output(['git','show',f'{COMMIT}:{RAW_PATH}'],cwd=ROOT)
    blob=subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()
    assert blob==RAW_BLOB
    for marker in ['1 <= size of S <= 100000',"'a' <= characters in S <= 'z'",'1 <= frequency of each character in S <= 1000']:
        assert marker in raw.decode(),marker
    public=[('a3c9b2c1','a3b2c10'),('a12b56c1','a12b56c1'),('z002a01z03','a1z5')]
    directed=['a1','z1','a1000','z999','a1a1','b1a1','a0001','z001000',
        'b12a34b56','a999a1','a1000a1000','z1y1x1','m01m002m0003',
        'a9a10a99a100a999a1000','z1000a1000','c1a1000b99c999',
        ''.join(chr(97+i)+'1' for i in range(26)),
        ''.join(chr(97+i)+'1000' for i in range(25,-1,-1))]
    specs=[s for s,_ in public]+directed
    keys=set(specs)
    assert len(keys)==len(specs)
    rng=random.Random(SEED)
    while len(specs)<163:
        s=''.join(rng.choice('abcdefxyz')+'0'*rng.randrange(5)+str(rng.randint(1,1000))
            for _ in range(rng.randint(1,20)))
        if s not in keys:keys.add(s);specs.append(s)
    refpath=OA/f'references/{PID}.py'
    refpath.parent.mkdir(parents=True,exist_ok=True)
    refpath.write_text(REFERENCE,encoding='utf-8')
    oracles=[]
    for i,s in enumerate(specs):
        expected=expanded_oracle(s)
        assert run(refpath,s)==expected,(s,expected)
        if i<3:assert expected==public[i][1]
        oracles.append({'input':s+'\n','expectedOutput':expected+'\n'})
    assert len(oracles)==len(keys)==163
    print(f'{PID}: 163 unique expanded-character oracle subprocess checks passed',flush=True)
    cases=[]
    for i,row in enumerate(oracles[:35]):
        cases.append({'name':(['raw样例1','raw样例2','本站前导零与重复字母样例'][i] if i<3 else f'独立边界组合{i-2}'),
            **row,'hidden':i>=3,'weight':1})
    many_letters=''.join(chr(97+i)+'1' for i in range(26))*1923+'a1b1'
    boundaries=[('满长度50000段','a1'*50000,'a50000'),
        ('满长度高总频次','a999'*25000,'a24975000'),
        ('满长度段频次1000','z1000'*20000,'z20000000'),
        ('99999位数字且数值1','a'+'0'*99998+'1','a1'),
        ('99999位数字且数值1000','z'+'0'*99995+'1000','z1000'),
        ('满长度覆盖所有字母',many_letters,''.join(chr(97+i)+str(1924 if i<2 else 1923) for i in range(26))),
        ('长前导零后继续解析','b'+'0'*99994+'1a2b3','a2b4')]
    boundary_evidence=[]
    for name,s,expected in boundaries:
        assert len(s)==100000,(name,len(s))
        cases.append({'name':name,'input':s+'\n','expectedOutput':expected+'\n','hidden':True,'weight':1})
        boundary_evidence.append({'name':name,'length':len(s),'expectedOutput':expected})
    assert len({x['input'] for x in cases})==len(cases)
    for case in cases:assert run(refpath,case['input'].strip())==case['expectedOutput'].strip(),case['name']
    killed=[]
    for i,mutant in enumerate(MUTANTS,1):
        path=OA/f'negative-controls/{PID}-{i}.py'
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(mutant['code'],encoding='utf-8')
        rejected=[]
        for j,case in enumerate(cases):
            if run(path,case['input'].strip())!=case['expectedOutput'].strip():rejected.append(j)
        assert rejected,mutant['name']
        killed.append({'name':mutant['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    print(f'{PID}: {len(cases)} formal subprocess cases; 2 normal-exit mutants rejected',flush=True)
    package={'schemaVersion':1,'problem':{
        'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'合并重复字母频次的规范压缩',
        'difficulty':'简单','tags':['OA','Goldman Sachs','字符串','计数'],
        'description':'字符串S由一个或多个“一个小写字母＋该字母的十进制频次”段拼接而成。'
            '相同字母可能出现多段。请合并每个字母所有段的次数，按a到z顺序输出每个出现过的字母及其总频次，'
            '每个字母只输出一次，数字不带前导零。输入保证编码合法；数字允许前导零，其数值仍须在1..1000内。'
            '原文没有禁止前导零，本站不新增这一限制；累加后的总次数可以超过1000。\n\n'
            '本站从固定完整raw恢复被catalog截断的字符与长度约束，标准输入输出由本站整理。',
        'input':'一行字符串S，不含引号或空格。完整原始范围：1≤|S|≤100000，字母a..z，'
            '每段频次数值1..1000；每个字母后至少有一位数字。有效编码最短为2字符，长度下界1不表示接受非法单字符编码。',
        'output':'输出一行规范压缩字符串，字母升序，每个字母后跟不带前导零的总次数。',
        'explanation':'样例1合并c9和c1为c10，按字母排序得a3b2c10。样例2已规范，保持不变。'
            '样例3是本站补充：z002和z03合并为z5，a01规范为a1，结果a1z5。',
        'hints':['逐段解析，不要只读取一位频次。','同字母次数相加，最终统一按字母顺序输出。',
            '超长前导零也是合法数字串，使用逐位十进制解析。'],
        'timeLimit':3,'memoryLimit':131072,'outputLimit':4,'checker':'tokens',
        'languages':['python','go','java','cpp']},'cases':cases}
    normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',normalize],cwd=ROOT,
        input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    package=json.loads(normalized)
    authored=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',package)
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'逐位解析与26桶累计',
        'explanation':EDITORIAL,'solutions':authored})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{
        'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),
        'editorial':EDITORIAL,'authoredSolutions':authored}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,
        'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{
        'url':URL,'contentHash':HASH,'catalogContentHash':HASH,'path':RAW_PATH,'gitBlobSha':RAW_BLOB,
        'rawSha256':sha(raw),'blobVerification':'git show at fixed commit, then git hash-object checked against pinned blob',
        'recoveredConstraints':['1 <= size of S <= 100000',"'a' <= characters in S <= 'z'",'1 <= frequency of each character in S <= 1000'],
        'siteAdded':'One-line standard I/O; compatibility with leading-zero frequency notation because source does not forbid it; canonical output has no leading zeros.',
        'upstreamCodeExecuted':False}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{
        'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':PREVIOUS,
        'reason':'固定raw完整保留长度10万、a-z、每段频次1..1000；恢复被HTML解析损坏的约束。'
            '兼容长前导零并逐位解析，163唯一展开字符oracle和42正式用例真实子进程通过，'
            '两个正常退出负控被拒绝。仅离线候选，尚未做真实GoJudge验证。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{
        'id':PID,'oracleCases':163,'uniqueOracleInputs':163,'publicCases':3,'hiddenCases':len(cases)-3,
        'referenceFormalCases':len(cases),'negativeControls':killed,'referenceSha256':sha(REFERENCE),
        'oracleMethod':'Regex segment parsing, actual character expansion, sorting and run-length encoding; no 26-bucket count accumulation.',
        'largeBoundaries':boundary_evidence,'subprocessValidation':True,'normalExitChecked':True,
        'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}: candidate generated; registry/coverage/reports untouched',flush=True)


if __name__=='__main__':main()
