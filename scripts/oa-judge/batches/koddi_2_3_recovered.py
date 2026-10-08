#!/usr/bin/env python3
"""Koddi-specific source recovery, reusing our authored independent test engines.

The imported modules are local authored generators, never upstream solution code.
Their JSON writes are captured; only the new Koddi IDs and batch are emitted.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
BATCH = 'koddi-2-3-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SOURCES = [
    ('OA LIST/Koddi_OA/002_image.txt', 'ed77d1e31145e4009a87fec15124cabf08b8bc83', '29f03597d486523c73fae0e5ccee5c157a83fb0bd68840f8bc35053b8db975ce'),
    ('OA LIST/Koddi_OA/003_image.txt', '29aa55a80b582055be4a8bad9666607c9705b61a', '3738a098c867a714d0bf281ae544a6ae5d17b5883c33d172623b13d25168b70d'),
    ('OA LIST/Koddi_OA/004_image.txt', 'ef7624c0399385ac8d73c19700ac12299db392ff', '68cb2d72cb3c085321df942be5d791b7eca6155ece5d7b72d18ddbd4f01e4151'),
    ('OA LIST/Koddi_OA/005_image.txt', '5787bbad8234a53ecda8074e40d40689cca876f9', '9452c7809531f50fac8962520b4a9dc438e4fb0b5e5de158edd216b6b9a4a316'),
    ('OA LIST/Koddi_OA/006_image.txt', '4352d7a6957753620c1236f36a80ad226d0a67ab', 'dd80c6429dcd2e13b5dfab0001014bbed09374c90bda86b1f55368dcd1a44c48'),
    ('OA LIST/Koddi_OA/007_image.txt', '190778190e53cff88954b23fc0129c3996da28ee', 'a81378bf5d3dc6ce58a4eb0220e225b0a25b5621efe203a5187ea45a3fab5002'),
    ('OA LIST/Koddi_OA/008_image.txt', '0ec7332d059f9bf6fb31783aface81eeae76cbc5', '5527fd176718df5e258d98bfb76bab236f5d0c4d78eed2fe2cebbcaa6dd5d3f3'),
]
BIRD_PROVENANCE = '''## Koddi原始规则、同题范围及漏项修正

固定提交e66f809f4c953bce129f68491726176615db6afc中，OA LIST/Koddi_OA/002_image.txt明确每次取走木棒后回到初始bird、从右开始交替搜索、累计至少100立即停止，并明确保证forest[bird]=0、总长度至少100，且未结束时每轮所需侧仍有木棒。旧blocked理由“未规定缺棒行为”不成立：此情况被原文保证排除，不需要自创越界处理。

002的示例数组漏了一个0，只有10项却输出下标10。003本身重复给出完整11项[25,0,50,0,0,0,0,15,0,0,45]，并逐步明确位置7、2、10的长度15、50、45，总和15、65、110，因此以Koddi003自身即可唯一纠正漏项，不靠另一家公司猜输入。原输出[7,2,10]保持不变。

Koddi002/003的数值约束页没有保存。范围明确采用同题OA LIST/Visa_OA/007_QQ_1741880100789.txt：3≤n≤1000、0≤forest[i]≤50、0≤bird<n。两者同题并非只凭标题：Koddi002与Visa004过程和保证逐句相同；Koddi003与Visa005/006完整11项输入、bird=4、输出[7,2,10]及15/65/110轨迹逐项一致。本站披露跨公司同题范围来源，不声称KoddiOCR自身给出数值上界。

Koddi整理页例[50,0,0,40,0,30,0,20]、bird=1合法，输出[3,0,5]正确；并不套用Visa整理页的非法例纠错。本题公开首例保留KoddiOCR原例，另两例为本站补充。采用n bird及数组作为输入、下标序列作为输出。未执行上游代码。

'''
MATRIX_PROVENANCE = '''## Koddi原始坐标、同题范围及整理页纠错

固定提交e66f809f4c953bce129f68491726176615db6afc中，OA LIST/Koddi_OA/004_image.txt定义蛋白质矩阵Y形：左上、右上沿对角线到中心，再从中心竖直到底。005逐格高亮确认坐标；006/007给出完整3×3和5×5输入，输出分别2与8；008再次展示5×5变换。形状内同色、背景同色且两色不同，共6种配色。

KoddiOCR没有保存奇数保证或n数值界。跨公司同题证据为：Koddi006与OA LIST/Databricks_OA/021_image.txt的完整3×3及5×5输入一致，两个输出2/8、两处修改位置、完整目标矩阵以及把8个0改为1的说明一致；Koddi005与Databricks020高亮位置一致。只改了蛋白质叙事和变量名，不是根据标题猜同题。

范围按证据分别采用：Databricks019明确n为奇数；同题fastprep/Databricks/databricks-write-l-matrix.md约束为5≤n≤99、元素0..2，但各来源共同原例有n=3。因此完整包络为{3}与奇数5..99的并集，即奇数3..99。不补n=1；不声称Koddi或DatabricksOCR本身给出99上界。fastprep的L童话和Databricks标题X与明确坐标冲突，以坐标为准。fastprep第二例漏一行，但Koddi006/007本身已有完整5×5，不需要猜补行。

Koddi整理页的十字矩阵[[0,1,0],[1,1,1],[0,1,0]]声称答案1，实际六种终态枚举最小为4：Y区0/1各2个，背景有3个1、2个0，令Y为0、背景为1改4格即达下界。整理页“4n−2个Y格子”也错误，正确为(3n−1)/2。本站保留OCR两原例2/8，不沿用错误整理例。第三公开例为本站补充。未执行上游代码。

'''


def sha(raw):
    return hashlib.sha256(raw.encode() if isinstance(raw, str) else raw).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def load_generator(filename):
    path = Path(__file__).with_name(filename)
    spec = importlib.util.spec_from_file_location(filename.removesuffix('.py'), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def normalized_package(package):
    code = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    return subprocess.run(['node', '--import', 'tsx', '-e', code], cwd=ROOT,
                          input=json.dumps(package, ensure_ascii=False), text=True,
                          capture_output=True, check=True).stdout


def main():
    for path, blob, digest in SOURCES:
        raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{path}'], cwd=ROOT)
        assert sha(raw) == digest
        assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == blob
    catalog = {x['id']: x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    coverage = {x['id']: x for x in json.loads((OA/'coverage.json').read_text())['items']}
    configs = [
        ('oa-koddi-2', '278420db306465a551f8ff24f3b193f79fa5ff02a049e02d8188b0f87aa7805f', 'visa_2_recovered.py', BIRD_PROVENANCE, '## 思路', SOURCES[:2]),
        ('oa-koddi-3', '819689c1c2353a9f58ed131f10ac5a8a0315943ab54e34fdb45a41fee107d039', 'databricks_25_recovered.py', MATRIX_PROVENANCE, '## 坐标定义与思路', SOURCES[2:]),
    ]
    candidate = {'schemaVersion': 1, 'items': []}
    evidence = {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {}}
    validation = {'schemaVersion': 1, 'problems': []}
    resolutions = {'schemaVersion': 1, 'items': []}
    for pid, digest, filename, provenance, section, koddi_sources in configs:
        module = load_generator(filename)
        module.PID, module.BATCH, module.HASH = pid, BATCH, digest
        module.SEED = 20261021 if pid.endswith('2') else 20261022
        module.EDITORIAL = provenance + section + module.EDITORIAL.split(section, 1)[1]
        if pid.endswith('2'):
            module.MUTANTS[0]['name'] = '采集后错误沿旧方向偏移再换向'
            module.EDITORIAL = module.EDITORIAL.replace('沿用MDX的采集后位置偏移', '采集后的错误位置偏移')
        captured = {}
        module.put = lambda folder, name, value: captured.__setitem__((folder, name), value)
        # The reused main writes only references/negative-controls directly; PID has
        # already been rebound. All other writes are captured, then source-adapted.
        module.main()
        package = captured[('packages', pid + '.json')]
        problem = package['problem']
        problem['tags'] = [x for x in problem['tags'] if x not in ('Visa', 'Databricks')] + ['Koddi']
        problem['explanation'] = provenance
        if pid.endswith('2'):
            problem['input'] += ' 数值范围来自原例与逐步过程完全一致的Visa007；Koddi002本身明确逐轮有棒保证，Koddi未保存数值界。'
            regression_input = module.encode([50,0,0,40,0,30,0,20], 1)
            regression_expected = '3 0 5\n'
        else:
            problem['title'] = '蛋白质矩阵的最少Y形修改'
            problem['description'] = problem['description'].replace('原始OCR标题字母有误，本题按其明确坐标定义，不按L或X字母猜图案。', 'Koddi原始蛋白质矩阵Y形按上述明确坐标定义。')
            problem['input'] = '第一行奇数n，随后n行各n个整数。n取3,5,7,…,99，值0..2。Koddi本身未保存n范围；同题Databricks019给奇数保证，fastprep给5..99，共同原例另含3；采用显式并集，不补n=1。'
            regression_input = module.encode([[0,1,0],[1,1,1],[0,1,0]])
            regression_expected = '4\n'
        # Also preserve and independently check the Koddi catalog example, correcting
        # only the demonstrably wrong matrix answer. This is an extra hidden case.
        if pid.endswith('2'):
            assert module.oracle([50,0,0,40,0,30,0,20], 1) == [3,0,5]
        else:
            assert module.oracle([[0,1,0],[1,1,1],[0,1,0]]) == 4
        package['cases'].append({'name': 'Koddi整理页例独立复算', 'input': regression_input,
                                 'expectedOutput': regression_expected, 'hidden': True, 'weight': 1})
        assert len(package['cases']) <= 64
        assert len({c['input'] for c in package['cases']}) == len(package['cases'])
        v = captured[('validation', BATCH + '.json')]['problems'][0]
        for case in package['cases']:
            actual, _ = module.run(OA / f'references/{pid}.py', case['input'])
            assert (actual if isinstance(actual, list) else actual.split()) == case['expectedOutput'].split()
        for i, mutant in enumerate(module.MUTANTS, 1):
            rejected = []
            for j, case in enumerate(package['cases']):
                actual, _ = module.run(OA / f'negative-controls/{pid}-{i}.py', case['input'])
                if (actual if isinstance(actual, list) else actual.split()) != case['expectedOutput'].split():
                    rejected.append(j)
            assert rejected
            v['negativeControls'][i-1]['rejectedByCases'] = rejected
        v.update({'referenceFormalCases': len(package['cases']), 'hiddenCases': len(package['cases'])-3,
                  'seed': module.SEED, 'generatorReuse': filename,
                  'reuseDisclosure': 'Re-executed authored local reference and independent oracle for new IDs and new seeds, not upstream code or copied validation reports.',
                  'koddiCatalogExampleChecked': {'input': regression_input, 'expectedOutput': regression_expected}})
        normalized = normalized_package(package)
        put('packages', pid+'.json', json.loads(normalized))
        for folder in ('oracles', 'mutants', 'editorials'):
            put(folder, pid+'.json', captured[(folder, pid+'.json')])
        entry = captured[('candidate-batches', BATCH+'.json')]['items'][0]
        entry['packageChecksum'] = sha(normalized)
        candidate['items'].append(entry)
        source_list = [dict(path=p, gitBlobSha=b, sha256=h, role='Koddi original statement/example') for p,b,h in koddi_sources]
        source_list += [dict(path=p, gitBlobSha=b, sha256=h, role='Same-problem cross-company rule/range/example corroboration') for p,b,h in module.SOURCES]
        evidence['items'][pid] = {
            'url': catalog[pid]['sourceUrl'], 'contentHash': digest, 'catalogContentHash': digest,
            'path': koddi_sources[0][0], 'gitBlobSha': koddi_sources[0][1], 'rawSha256': koddi_sources[0][2],
            'sources': source_list, 'upstreamCodeExecuted': False,
            'sameProblemAndRangeDisclosure': provenance,
            'recoveredConstraints': captured[('source-evidence', BATCH+'.json')]['items'][pid]['recoveredConstraints'],
            'siteAdded': 'Standard textual serialization; site-added public examples explicitly identified. Cross-company numeric range adopted only with identical source examples and rule evidence.',
        }
        resolutions['items'].append({'id': pid, 'batch': BATCH, 'sourceContentHash': digest,
                                     'previousReason': coverage[pid].get('reason', ''),
                                     'reason': provenance + '\n163独立oracle、完整边界与正常退出负控通过；仅候选待沙箱。'})
        validation['problems'].append(v)
        print(f'{pid}: frozen {len(package["cases"])} cases, checksum {sha(normalized)}', flush=True)
    put('candidate-batches', BATCH+'.json', candidate)
    put('source-evidence', BATCH+'.json', evidence)
    put('resolutions', BATCH+'.json', resolutions)
    put('validation', BATCH+'.json', validation)
    print(f'{BATCH}: all Koddi artifacts frozen', flush=True)


if __name__ == '__main__':
    main()
