"""Source-corrected Amazon 7/22 candidates; never execute upstream code."""
from collections import deque
from itertools import permutations
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
UPSTREAM = Path('/private/tmp/oa-master-readonly')
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
BATCH = 'amazon-7-22-recovered'
SEED = 20261008

WINNER = '''import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    n = next(tokens)
    players = [sorted((next(tokens), next(tokens), next(tokens))) for _ in range(n)]
    # The two largest entries retain their identities, including equal values.
    def extrema(column):
        best = second = -1
        owner = -1
        for i, row in enumerate(players):
            value = row[column]
            if value > best:
                second, best, owner = best, value, i
            elif value > second:
                second = value
        return best, second, owner
    a, a2, ai = extrema(0)
    b, b2, bi = extrema(1)
    answer = 0
    for i, row in enumerate(players):
        opponent_min = a2 if i == ai else a
        opponent_middle = b2 if i == bi else b
        answer += row[1] > opponent_min and row[2] > opponent_middle
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
'''

PARCEL = '''import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    n = next(tokens)
    positive = set()
    for _ in range(n):
        value = next(tokens)
        if value > 0:
            positive.add(value)
    return str(len(positive))

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
'''

WINNER_MUTANTS = [
    {'name': '错误按排序同位置比较多数', 'code': '''import sys
it=iter(map(int,sys.stdin.buffer.read().split())); n=next(it)
p=[sorted((next(it),next(it),next(it))) for _ in range(n)]
print(sum(all(sum(x>y for x,y in zip(p[i],p[j]))>=2 for j in range(n) if i!=j) for i in range(n)))
'''},
    {'name': '把相等强化值也算胜利', 'code': WINNER.replace('row[1] > opponent_min and row[2] > opponent_middle', 'row[1] >= opponent_min and row[2] >= opponent_middle')},
]
PARCEL_MUTANTS = [
    {'name': '把零库存计作一个配送日', 'code': PARCEL.replace('if value > 0:', 'if value >= 0:')},
    {'name': '每天只发一件导致返回最大库存', 'code': '''import sys
a=list(map(int,sys.stdin.buffer.read().split()))
print(max(a[1:]))
'''},
]


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode_winner(players):
    return str(len(players)) + '\n' + ''.join(' '.join(map(str, row)) + '\n' for row in players)


def encode_parcel(values):
    return str(len(values)) + '\n' + ' '.join(map(str, values)) + '\n'


def winner_oracle(players):
    """Exhaust every assignment of an opponent to a fixed player round order.

    Simultaneously permuting rounds preserves the number of wins, so all six
    opponent permutations cover every relative pairing. No sorting inequality.
    """
    answer = 0
    for i, row in enumerate(players):
        wins_every = True
        for j, opponent in enumerate(players):
            if i == j:
                continue
            possible = any(sum(a > b for a, b in zip(row, ordering)) >= 2
                           for ordering in permutations(opponent))
            if not possible:
                wins_every = False
                break
        answer += wins_every
    return answer


def parcel_oracle(values):
    """BFS of literal legal shipments; no distinct-value counting formula."""
    start = tuple(sorted(values))
    queue = deque([(start, 0)])
    seen = {start}
    while queue:
        state, days = queue.popleft()
        if not any(state):
            return days
        minimum = min(value for value in state if value > 0)
        for shipment in range(1, minimum + 1):
            following = tuple(value - shipment if value else 0 for value in state)
            if following not in seen:
                seen.add(following)
                queue.append((following, days + 1))
    raise AssertionError('Every finite nonnegative stock can be delivered')


def run(code, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-c', code], input=raw, text=True,
                            capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip(), round(time.perf_counter() - started, 4)


WINNER_EDITORIAL = '''## 固定来源更正与本站范围

固定 OAMaster 提交 e66f809f4c953bce129f68491726176615db6afc 的 fastprep/Amazon/amazon-find-capable-winners.md 明确：存在双方的一种配对排列，使 X 严格赢至少两回合，就称 X 能击败 Y；不是同一排列必须胜过 Y 的所有排列。原文给出 X=[9,5,11]、Y=[7,12,3] 可互相击败。早期 #7 摘要的 any rearrangement 用词与原文 some rearrangement 不符，本站据原文更正；三语言排序后同位置比较多数的来源实现也不正确，不执行或复用它们。

原始文件要求每位玩家的三个值互异，但 #7 摘要未限制重复。本站明确保留更宽的每组可重复值输入域，仍按上述严格胜利定义评测；这是范围扩展，不是伪称原题允许重复。raw 与摘要都规定 2≤n≤100000、强化值1..10^9，不扩展n=1。标准I/O由本站补充，不改变不同对手可选不同排列的语义。该原始完整题同时对应已收录 #142，但本ID重新绑定全部来源、题包与验证证据。

## 正确性证明

把每个三元组排序为 a≤b≤c。X 能击败 Y 当且仅当 bX>aY 且 cX>bY：若存在两局严格胜利，把胜出的两枚按大小排列，较小的不会大于bX，而对应两枚被击败值中较小的不会小于aY；较大的胜出值至多cX，对方较大被击败值至少bY，得必要条件。反过来直接以bX配aY、cX配bY即可赢两局。

因此每位玩家只需超过所有其他玩家的最小值和中间值最大值。分别记录这两列最大值、最大值所属玩家以及排除该玩家后的次大值，次大值允许与最大值相等。检查时精确排除本人。不能把自己也放进比较集合：如[2,2,2]对[1,1,1]，第一人可胜，但包含自身的最小值最大值会错误拒绝它。

排序三个数是常数操作，建立极值和逐人检查均为O(n)，总时间O(n)、空间O(n)。使用严格大于；平局不算赢。答案可为0或n。独立oracle逐对枚举六种相对排列，不使用上述排序不等式。

## 样例核对

#7原摘要四人样例按正确规则为2，获胜者是第2与第4人；来源同位置多数代码错误地只算第4人。raw双人例双方可互胜，所以也是2。本站补充两个[1,1,1]的重复值例，没人能严格赢两局，答案0。
'''

PARCEL_EDITORIAL = '''## 固定来源更正

固定 OAMaster 提交 e66f809f4c953bce129f68491726176615db6afc 的 fastprep/Amazon/amazon-min-days-to-deliver-parcels.md 要求每天从每个仍有至少一个包裹的中心发出相同数量，不能跳过非空中心。因此每日正整数d不得超过当前最小正库存。早期 #22 摘要添加的“少于d就跳过”改变了核心操作，本站据原始文件明确更正，而非另造规则。固定来源三语言的不同正值集合算法与原始规则一致。

完整保留n≤10^6、库存0..10^9；零库存不参与，原本全零需0天。标准I/O为本站补充。原始完整题亦对应 #284，此处重新绑定本ID全部来源与验证证据。最大常规整数输入11000008字节，处于32 MiB输入预算内。

## 正确性证明

将所有严格正的库存加入集合，返回集合大小。每天所有非空中心扣相同数值，仍非空的不同库存之间差值不变，一天最多消去当前最小正库存这一层。因此至少需要初始不同正库存数量那么多天。每天选择当前最小正库存，恰好消去一层并保持其余层互异，达到该下界。全零时层数为0。

参考程序逐个转换输入token并加入集合，不另存完整整数数组。期望时间O(n)，额外集合O(u)，u为不同正值个数；输入分词额外O(n)。独立oracle在小输入上BFS枚举每天所有合法d并寻找最短清空路径，不用集合计数公式。

## 区分错误摘要

[1,2,3]按原规则必须3天；先减2跳过库存1中心的2天方案不合法。原例[2,3,4,3,3]依次减2、1、1共3天；全部为3的中心一天结束。本站补充全零例应为0。
'''


def specifications():
    yield dict(number=7, reference=WINNER, mutants=WINNER_MUTANTS,
               title='三回合存在配对的全胜玩家数', encode=encode_winner, oracle=winner_oracle,
               public=[([[3,2,8],[4,11,7],[1,5,9],[16,6,10]],2),
                       ([[9,5,11],[7,12,3]],2), ([[1,1,1],[1,1,1]],0)],
               fixed=[[[2,2,2],[1,1,1]], [[1,2,3],[3,4,5]],
                      [[1,5,9],[2,6,10],[3,7,11]], [[2,2,3],[2,2,3]],
                      [[1,3,3],[1,2,2]], [[10**9]*3,[1]*3]],
               random=lambda rng:[[rng.randint(1,9) for _ in range(3)] for _ in range(rng.randint(2,7))],
               boundaries=lambda:[('十万互异三元组人人可胜', [[1,2,3]]*100000,100000),
                                  ('十万重复上界无人可胜', [[10**9]*3]*100000,0),
                                  ('唯一上界玩家与低值重复组', [[1]*3]*99999+[[10**9]*3],1),
                                  ('最大次大端点同值重复', [[1,1,2]]*100000,0)],
               editorial=WINNER_EDITORIAL, source_hash='894f92e4c63616d093fcb1f282c2bc28c5e54ba9472b7faa41039c2d97509593',
               raw_path='fastprep/Amazon/amazon-find-capable-winners.md',
               raw_hash='14b3c7a35958fa2c1565ba137a67e9a7a75781d3330500e3d8d60c20e5ce8957',
               raw_markers=['some rearrangement of power boosters of Y', 'All power boosters of each player are pairwise distinct.'],
               related_id='oa-amazon-142',
               corrections=['把摘要any改回原始some：存在双方的一种排列配对即可', '替换来源错误的排序同位置多数判断', '原raw每组三值互异，本站保留摘要的更宽可重复值域并明确标注'],
               description='每位玩家有三个强化值，每局分三回合且每枚只使用一次。若存在双方的一种排列配对，使X在至少两回合的数值严格大于Y，则X能击败Y。统计能分别击败每位其他玩家的人数；不同对手可以选不同排列，平局不算胜利。固定原始题文明确是存在配对，本站纠正早期摘要“对任意排列”的错误措辞。原始题要求每人三值互异，但早期摘要未限制重复；本站明确采用更宽的可重复值范围，胜负规则不变。',
               input='第一行n；随后n行，每行三个强化值。raw与摘要共同范围：2≤n≤100000，1≤强化值≤10^9。本站范围扩展：同一行可重复，跨玩家也可重复。标准I/O由本站补充。',
               explanation='样例1是早期摘要原例，正确获胜者为第2、4人，共2。样例2来自原始题文，两人均能找到赢两回合的配对，答案2。样例3为本站重复值补充：所有回合都平局，答案0。',
               oracle_method='枚举每对玩家的全部六种相对排列，直接逐回合严格比较；不使用排序阈值公式。')
    yield dict(number=22, reference=PARCEL, mutants=PARCEL_MUTANTS,
               title='所有非空中心同量配送的最少天数', encode=encode_parcel, oracle=parcel_oracle,
               public=[([2,3,4,3,3],3), ([3,3,3,3,3,3],1), ([0,0],0)],
               fixed=[[1,2,3], [0], [1], [0,1], [1,1], [0,2,2,4], [7,1,4,0]],
               random=lambda rng:[rng.randint(0,8) for _ in range(rng.randint(1,7))],
               boundaries=lambda:[('百万中心均零', [0]*1000000,0),
                                  ('百万中心最大值最坏十进制输入', [10**9]*1000000,1),
                                  ('百万不同正库存最大答案', list(range(1,1000001)),1000000),
                                  ('百万中心含零及两个高值', [0,10**9,10**9-1,0]*250000,2)],
               editorial=PARCEL_EDITORIAL, source_hash='65a7f646e3f903c30d73a7ade42e615fa27850af06012625f0fdfad9361efd7f',
               raw_path='fastprep/Amazon/amazon-min-days-to-deliver-parcels.md',
               raw_hash='d2f10a89278137e3e999b4e0c771e4339e4f7ff80214b9ea14ce565867a06091',
               raw_markers=['each delivery center that has at least one parcel remaining.', '0 ≤ parcels[i] ≤ 10^9'],
               related_id='oa-amazon-284',
               corrections=['摘要少于d中心可跳过不符原文；所有非空中心都必须发同样数量', '明确d≤当前最小正库存，全零需0天'],
               description='每天选择一个正整数d，从每个仍有包裹的中心都发出恰好d件，不能跳过任何非空中心，也不能超过它的现有库存；空中心不参与。求全部库存清空的最少天数，全零时为0。本站依据固定原始题文纠正早期摘要“库存少于d的中心可跳过”的错误描述；原文要求每个仍有至少一个包裹的中心都参与。',
               input='第一行n；第二行n个parcels[i]。完整原始范围：1≤n≤1000000，0≤parcels[i]≤10^9。标准I/O为本站补充，单输入预算32 MiB，不缩小百万级范围。',
               explanation='原例1依次发2、1、1件，需3天。原例2每天从全部六个中心发3件，一天完成。样例3为本站全零补充，无需操作，答案0。',
               oracle_method='对小库存状态BFS，逐日枚举1..最小正库存的所有合法同量配送，求最少清空步数；不调用不同正值集合公式。')


def main():
    assert not (OA / 'batches' / (BATCH + '.json')).exists(), 'Already promoted'
    sources = {x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    prior = {x['id']:x for x in json.loads((OA/'reviews/amazon-remaining-a.json').read_text())['items']}
    mdx_path = 'web/content/docs/companies/amazon.mdx'
    mdx = subprocess.check_output(['git','show',f'{COMMIT}:{mdx_path}'],cwd=UPSTREAM)
    mdx_blob = subprocess.check_output(['git','rev-parse',f'{COMMIT}:{mdx_path}'],cwd=UPSTREAM,text=True).strip()
    manifests, reports, evidence, resolutions = [], [], [], []
    for spec in specifications():
        pid = 'oa-amazon-' + str(spec['number'])
        source = sources[pid]
        assert source['contentHash'] == spec['source_hash']
        section = mdx.decode().split(f"## {spec['number']}. ",1)[1].split(f"\n## {spec['number']+1}. ",1)[0]
        assert all(solution['code'] in section for solution in source['solutions'])
        raw = subprocess.check_output(['git','show',f"{COMMIT}:{spec['raw_path']}"],cwd=UPSTREAM)
        assert sha(raw) == spec['raw_hash']
        assert all(marker in raw.decode() for marker in spec['raw_markers'])
        blob = subprocess.check_output(['git','rev-parse',f"{COMMIT}:{spec['raw_path']}"],cwd=UPSTREAM,text=True).strip()
        unique, cases = {}, []
        for i,(values, expected) in enumerate(spec['public']):
            assert spec['oracle'](values) == expected
            text = spec['encode'](values)
            unique[text] = expected
            cases.append(dict(name=f'公开样例{i+1}',input=text,expectedOutput=f'{expected}\n',hidden=False,weight=1))
        for values in spec['fixed']:
            unique[spec['encode'](values)] = spec['oracle'](values)
        rng = random.Random(SEED + spec['number'])
        while len(unique) < 163:
            values = spec['random'](rng)
            unique[spec['encode'](values)] = spec['oracle'](values)
        for i,(text,expected) in enumerate(list(unique.items())[3:31]):
            cases.append(dict(name=f'独立oracle{i+1}',input=text,expectedOutput=f'{expected}\n',hidden=True,weight=1))
        timings = []
        for text, expected in unique.items():
            actual, elapsed = run(spec['reference'], text)
            assert actual == str(expected), (pid,text,actual,expected)
            timings.append(elapsed)
        boundaries = []
        for name,values,expected in spec['boundaries']():
            text = spec['encode'](values)
            actual, elapsed = run(spec['reference'], text)
            assert actual == str(expected), (pid,name,actual,expected)
            cases.append(dict(name=name,input=text,expectedOutput=f'{expected}\n',hidden=True,weight=1))
            boundaries.append(dict(name=name,inputBytes=len(text.encode()),expectedOutput=actual,wallSeconds=elapsed,exitCode=0))
        killed=[]
        for i,mutant in enumerate(spec['mutants'],1):
            rejected=[]
            for case in cases[:31]:
                actual,_=run(mutant['code'],case['input'])
                if actual != case['expectedOutput'].strip():
                    rejected.append(case['name'])
                    break
            assert rejected, mutant['name']
            killed.append(dict(name=mutant['name'],rejectedByCases=rejected,exitCode=0))
            (OA/'negative-controls'/f'{pid}-{i}.py').write_text(mutant['code'])
        package={'schemaVersion':1,'problem':dict(id=pid,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Amazon'],description=spec['description'],input=spec['input'],output='输出一个整数答案。',explanation=spec['explanation'],hints=['请先确认原始操作规则以及严格比较条件。'],timeLimit=6,memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp']),'cases':cases}
        normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
        result=subprocess.run(['node','--import','tsx','-e',normalize],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True)
        package=json.loads(result.stdout)
        put('packages',f'{pid}.json',package)
        (OA/'references'/f'{pid}.py').write_text(spec['reference'])
        authored=[dict(language='python',code=spec['reference'])]
        put('editorials',f'{pid}.json',dict(schemaVersion=1,id=pid,title=spec['title'],explanation=spec['editorial'],solutions=authored,sourceUrl=source['sourceUrl'],sourceContentHash=spec['source_hash']))
        put('oracles',f'{pid}.json',[dict(input=text,expectedOutput=f'{expected}\n') for text,expected in unique.items()])
        put('mutants',f'{pid}.json',spec['mutants'])
        manifests.append(dict(id=pid,sourceContentHash=spec['source_hash'],packageChecksum=sha(result.stdout),editorial=spec['editorial'],authoredSolutions=authored))
        reports.append(dict(id=pid,oracleCases=len(unique),uniqueOracleInputs=len(unique),publicCases=3,hiddenCases=len(cases)-3,formalCases=len(cases),negativeControls=killed,referenceSha256=sha(spec['reference']),oracleMethod=spec['oracle_method'],oracleMaxWallSeconds=max(timings),largeBoundaries=boundaries))
        evidence.append(dict(id=pid,sourcePath=spec['raw_path'],gitBlob=blob,sourceSha256=sha(raw),sourceContentHash=spec['source_hash'],sourceUrl=source['sourceUrl'],mdxPath=mdx_path,mdxGitBlob=mdx_blob,mdxSha256=sha(mdx),relatedAuthoredId=spec['related_id'],relatedCatalogContentHash=sources[spec['related_id']]['contentHash'],sourceImplementations=[dict(language=x['language'],sha256=sha(x['code'])) for x in source['solutions']],corrections=spec['corrections'],siteAdditions=['标准输入输出与明确标记的补充公开样例'],upstreamCodeExecuted=False))
        resolutions.append(dict(id=pid,batch=BATCH,sourceContentHash=spec['source_hash'],previousReason=prior[pid]['reason'],reason='固定原始快照纠正摘要：'+'；'.join(spec['corrections'])+'。163个唯一独立oracle、35个正式测试含完整最大域、两个正常退出mutant已本地验证；候选尚待真实GoJudge。'))
        print(json.dumps(dict(id=pid,oracleCases=len(unique),formalCases=len(cases),boundaries=boundaries),ensure_ascii=False),flush=True)
    put('candidate-batches',BATCH+'.json',dict(schemaVersion=1,items=manifests))
    put('validation',BATCH+'.json',dict(schemaVersion=1,seed=SEED,problems=reports,note='只执行本站编写参考和错误程序的真实Python subprocess；不执行来源代码。仅本地候选，未运行GoJudge、未晋级、未发布。'))
    put('source-evidence',BATCH+'.json',dict(schemaVersion=1,sourceCommit=COMMIT,items=evidence))
    put('resolutions',BATCH+'.json',dict(schemaVersion=1,items=resolutions))


if __name__ == '__main__':
    main()
