#!/usr/bin/env python3
"""Run private references ONLY through an existing authenticated go-judge sandbox."""
import argparse,datetime,hashlib,json,os,re,urllib.request,urllib.parse
from pathlib import Path
import math
from functools import partial
from result_contract import KINDS, CHECKERS, compare_output, compare_batch, validate_result, validate_expected_output, resource_limits, MAX_ORACLE_BYTES

def run(source,stdin,batch=False,problem=None):
    limits=resource_limits({} if problem is None else problem)
    url=os.environ.get('GO_JUDGE_URL','http://127.0.0.1:5050').rstrip('/')
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' and not(parsed.scheme=='http' and parsed.hostname in ('localhost','127.0.0.1','::1')):raise ValueError('Require loopback or HTTPS')
    cpu=limits['timeLimit'];clock=max(3,cpu*3);output=limits['outputLimit']*1024
    cmd=dict(args=['/usr/bin/python3','main.py']+(['--batch'] if batch else []),env=['PATH=/usr/bin:/bin','HOME=/w','LANG=C.UTF-8'],files=[{'content':stdin},{'name':'stdout','max':output,'pipe':True},{'name':'stderr','max':min(output,65536),'pipe':True}],cpuLimit=math.ceil(cpu*1_000_000_000),clockLimit=math.ceil(clock*1_000_000_000),memoryLimit=limits['memoryLimit']*1024,procLimit=16,copyIn={'main.py':{'content':source}})
    req=urllib.request.Request(url+'/run',data=json.dumps({'cmd':[cmd]}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+os.environ.get('GO_JUDGE_TOKEN','')})
    with urllib.request.urlopen(req,timeout=max(20,clock+10)) as response:results=json.load(response)
    if len(results)!=1:raise RuntimeError('Unexpected sandbox response')
    return results[0]

def checked(result,expected):
    actual=result.get('files',{}).get('stdout','').split()
    return result['status']=='Accepted' and actual==list(map(str,expected))

def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def snapshot_inputs(data, source_hashes_path):
    """Freeze all bytes before contacting the runner; fail closed on missing provenance."""
    snapshots = {}
    def capture(path):
        raw = path.read_bytes()
        snapshots[path] = digest(raw)
        return raw
    hashes = json.loads(capture(source_hashes_path))
    manifest = json.loads(capture(data / 'manifest.json'))
    if not manifest.get('problems'):
        raise ValueError('Generation manifest must contain problems')
    prepared = []
    seen = set()
    for item in manifest['problems']:
        ident = item['id']
        if not isinstance(ident,str) or not re.fullmatch(r'lc-[1-9][0-9]*',ident) or ident in seen:
            raise ValueError('Duplicate or invalid problem identity')
        seen.add(ident)
        source_hash = hashes.get(ident) if isinstance(hashes, dict) else None
        if not isinstance(source_hash, str) or not re.fullmatch(r'[0-9a-f]{64}', source_hash):
            raise ValueError('Missing or invalid sourceContentHash for ' + ident)
        raw = capture(data / (ident + '.candidate.json'))
        reference = capture(data / (ident + '.reference.py'))
        oracle_raw = capture(data / (ident + '.oracle.json'))
        mutation_raw = capture(data / (ident + '.mutants.json'))
        if digest(raw) != item['packageSha256'] or digest(reference) != item['wrapperSha256']:
            raise ValueError('Input bytes do not match generation manifest: ' + ident)
        if digest(mutation_raw) != item.get('mutantsSha256'):
            raise ValueError('Mutation bytes do not match generation manifest: ' + ident)
        if len(oracle_raw)>MAX_ORACLE_BYTES:
            raise ValueError('Oracle sidecar exceeds 32 MiB')
        oracle = json.loads(oracle_raw)
        package = json.loads(raw)
        problem = package.get('problem',{})
        limits = resource_limits(problem)
        kind = item.get('resultKind','integer')
        encoding = item.get('oracleEncoding','legacy-integer')
        if kind not in KINDS or encoding not in ('legacy-integer','jsonl-v1') or kind!='integer' and encoding!='jsonl-v1':
            raise ValueError('Invalid result kind or oracle encoding: '+ident)
        # Only historical legacy-integer manifests may omit the generation-time hash.
        # Every declared hash binds the independent oracle before sandbox execution.
        if 'oracleSha256' in item:
            oracle_hash=item['oracleSha256']
            if (not isinstance(oracle_hash,str) or not re.fullmatch(r'[0-9a-f]{64}',oracle_hash)
                    or digest(oracle_raw)!=oracle_hash):
                raise ValueError('Oracle bytes do not match generation manifest: '+ident)
        elif encoding=='jsonl-v1':
            raise ValueError('JSONL oracle requires generation-time oracleSha256: '+ident)
        checker = problem.get('checker','tokens')
        if item.get('checker',checker)!=checker or item.get('resourceLimits',limits)!=limits:
            raise ValueError('Manifest runtime contract differs from package: '+ident)
        if checker != CHECKERS[kind]:
            raise ValueError('Result kind does not match formal output checker: '+ident)
        if (oracle.get('resultKind',None if encoding=='jsonl-v1' else kind)!=kind
                or oracle.get('oracleEncoding',None if encoding=='jsonl-v1' else encoding)!=encoding):
            raise ValueError('Oracle metadata differs from generation manifest: '+ident)
        cases = package.get('cases')
        args, expected = oracle.get('args'), oracle.get('expected')
        if (not isinstance(args, list) or not isinstance(expected, list)
                or len(args) < 120 or len(args) != len(expected)
                or type(item.get('oracleCases')) is not int or len(args) != item['oracleCases']):
            raise ValueError('Oracle must contain matching declared arguments and answers, at least 120: ' + ident)
        if (not isinstance(cases, list) or not 2 <= len(cases) <= 64
                or type(item.get('formalCases')) is not int or len(cases) != item['formalCases']):
            raise ValueError('Formal case count must match manifest and be between 2 and 64: ' + ident)
        if encoding=='jsonl-v1' and any(type(a) is not list for a in args):
            raise ValueError('Each oracle invocation must be a positional argument list')
        for value in expected:
            validate_result(kind,value)
        for case in cases:
            if not isinstance(case,dict) or not isinstance(case.get('input'),str):
                raise ValueError('Invalid formal case')
            validate_expected_output(kind,case.get('expectedOutput'))
            if len(case['expectedOutput'].encode('utf-8'))>limits['outputLimit']*1024:
                raise ValueError('Expected output exceeds declared runtime output limit')
        mutations = json.loads(mutation_raw)
        if (not isinstance(mutations, list) or not mutations
                or any(not isinstance(m, dict) or not isinstance(m.get('name'), str)
                       or not m['name'].strip() or not isinstance(m.get('source'), str)
                       or not m['source'].strip() for m in mutations)):
            raise ValueError('At least one named incorrect program is required: ' + ident)
        entry = {**item, 'sourceContentHash': source_hash,
                 'resultKind':kind, 'oracleEncoding':encoding, 'checker':checker,
                 'resourceLimits':limits,
                 'inputBytesSha256': digest(raw), 'referenceBytesSha256': digest(reference),
                 'oracleSha256': digest(oracle_raw), 'mutationSha256': digest(mutation_raw),
                 'counts': {'formal': len(cases), 'oracle': len(args), 'negativeControls': 1 + len(mutations)},
                 'checks': [], 'status': 'failed'}
        prepared.append((entry, raw, reference.decode('utf-8'), oracle, mutations))
    return snapshots, prepared


def assert_unchanged(snapshots):
    for path, expected in snapshots.items():
        if digest(path.read_bytes()) != expected:
            raise ValueError('Validation input changed during sandbox execution: ' + path.name)


def check_mutation(mutation, cases, runner=run, checker='tokens'):
    """A crash is not proof of wrong-answer coverage; require a clean wrong output."""
    attempts = []
    for case in cases:
        result = runner(mutation['source'], case['input'])
        killed = result['status'] == 'Accepted' and not compare_output(checker,result.get('files',{}).get('stdout',''),case['expectedOutput'])
        attempts.append({'case': case['name'], 'status': result['status'], 'killed': killed})
        if killed:
            break
    return {'name': 'common incorrect algorithm: ' + mutation['name'],
            'passed': any(a['killed'] for a in attempts), 'attempts': attempts,
            'programSha256': digest(mutation['source'].encode())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', type=Path, required=True)
    ap.add_argument('--source-hashes', type=Path, required=True)
    a = ap.parse_args()
    (a.data / 'verified-manifest.json').unlink(missing_ok=True)
    snapshots, prepared = snapshot_inputs(a.data, a.source_hashes)
    report = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'engine': 'go-judge', 'concurrency': 1,
              'sourceHashesFileSha256': snapshots[a.source_hashes], 'problems': []}
    failed = False
    for entry, raw, src, oracle, mutations in prepared:
        ident = entry['id']
        (a.data / (ident + '.json')).unlink(missing_ok=True)
        pkg = json.loads(raw)
        runner = partial(run,problem=entry['resourceLimits'])
        checker = entry['checker']
        try:
            negative = runner('print(-999999999999)\n', pkg['cases'][0]['input'])
            entry['checks'].append({'name': 'incorrect constant-output rejection',
                'status': negative['status'], 'passed': negative['status'] == 'Accepted'
                and not compare_output(checker,negative.get('files',{}).get('stdout',''),pkg['cases'][0]['expectedOutput'])})
            v = runner(src, json.dumps(oracle['args']), True)
            for mutation in mutations:
                entry['checks'].append(check_mutation(mutation, pkg['cases'], runner, checker))
            entry['checks'].append({'name': str(entry['counts']['oracle']) + ' independent small-instance oracle comparisons',
                'status': v['status'], 'passed': v['status']=='Accepted' and compare_batch(v.get('files',{}).get('stdout',''),oracle['expected'],entry['resultKind'],entry['oracleEncoding']),
                'cpuNs': v.get('time'), 'memoryBytes': v.get('memory')})
            for case in pkg['cases']:
                v = runner(src, case['input'])
                entry['checks'].append({'name': case['name'], 'status': v['status'],
                    'passed': v['status']=='Accepted' and compare_output(checker,v.get('files',{}).get('stdout',''),case['expectedOutput']),
                    'cpuNs': v.get('time'), 'memoryBytes': v.get('memory')})
            if all(c['passed'] for c in entry['checks']):
                entry['status'] = 'verified'
            else:
                failed = True
        except Exception as e:
            entry['error'] = type(e).__name__
            failed = True
        report['problems'].append(entry)
        (a.data / 'verification-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(ident, entry['status'], sum(c['passed'] for c in entry['checks']), '/', len(entry['checks']), flush=True)
    try:
        assert_unchanged(snapshots)
    except (ValueError, OSError) as e:
        report['inputIntegrityError'] = str(e)
        failed = True
        for entry in report['problems']:
            entry['status'] = 'invalidated'
    report['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report['allPassed'] = not failed
    (a.data / 'verification-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if failed:
        raise SystemExit(1)
    # Write the frozen bytes actually executed, never recopy a potentially changed source.
    for entry, raw, _, _, _ in prepared:
        (a.data / (entry['id'] + '.json')).write_bytes(raw)
    publish = [dict(problemId=e['id'], packageFile=e['id'] + '.json',
        packageSha256=e['packageSha256'], verified=True, sourceContentHash=e['sourceContentHash'],
        referenceSha256=e['referenceSha256'], runnerSha256=e['wrapperSha256'],
        inputBytesSha256=e['inputBytesSha256'], referenceBytesSha256=e['referenceBytesSha256'],
        oracleSha256=e['oracleSha256'], mutationSha256=e['mutationSha256'],
        counts=e['counts'], resultKind=e['resultKind'], oracleEncoding=e['oracleEncoding'],
        checker=e['checker'], resourceLimits=e['resourceLimits'],
        sourceUrl=e['sourceUrl'], sourceUrlZh=e['sourceUrlZh']) for e in report['problems']]
    (a.data / 'verified-manifest.json').write_text(json.dumps(
        {'verifiedAt':report['finishedAt'], 'sourceHashesFileSha256':report['sourceHashesFileSha256'],
         'problems':publish}, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    main()
