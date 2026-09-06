#!/usr/bin/env python3
"""Run private references ONLY through an existing authenticated go-judge sandbox."""
import argparse,datetime,hashlib,json,os,re,urllib.request,urllib.parse
from pathlib import Path

def run(source,stdin,batch=False):
    url=os.environ.get('GO_JUDGE_URL','http://127.0.0.1:5050').rstrip('/')
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' and not(parsed.scheme=='http' and parsed.hostname in ('localhost','127.0.0.1','::1')):raise ValueError('Require loopback or HTTPS')
    cmd=dict(args=['/usr/bin/python3','main.py']+(['--batch'] if batch else []),env=['PATH=/usr/bin:/bin','HOME=/w','LANG=C.UTF-8'],files=[{'content':stdin},{'name':'stdout','max':65536,'pipe':True},{'name':'stderr','max':65536,'pipe':True}],cpuLimit=2_000_000_000,clockLimit=6_000_000_000,memoryLimit=268435456,procLimit=16,copyIn={'main.py':{'content':source}})
    req=urllib.request.Request(url+'/run',data=json.dumps({'cmd':[cmd]}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+os.environ.get('GO_JUDGE_TOKEN','')})
    with urllib.request.urlopen(req,timeout=20) as response:results=json.load(response)
    if len(results)!=1:raise RuntimeError('Unexpected sandbox response')
    v=results[0]
    return v

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
    prepared = []
    for item in manifest['problems']:
        ident = item['id']
        source_hash = hashes.get(ident) if isinstance(hashes, dict) else None
        if not isinstance(source_hash, str) or not re.fullmatch(r'[0-9a-f]{64}', source_hash):
            raise ValueError('Missing or invalid sourceContentHash for ' + ident)
        raw = capture(data / (ident + '.candidate.json'))
        reference = capture(data / (ident + '.reference.py'))
        oracle_raw = capture(data / (ident + '.oracle.json'))
        if digest(raw) != item['packageSha256'] or digest(reference) != item['wrapperSha256']:
            raise ValueError('Input bytes do not match generation manifest: ' + ident)
        entry = {**item, 'sourceContentHash': source_hash,
                 'inputBytesSha256': digest(raw), 'referenceBytesSha256': digest(reference),
                 'oracleSha256': digest(oracle_raw), 'checks': [], 'status': 'failed'}
        prepared.append((entry, raw, reference.decode('utf-8'), json.loads(oracle_raw)))
    return snapshots, prepared


def assert_unchanged(snapshots):
    for path, expected in snapshots.items():
        if digest(path.read_bytes()) != expected:
            raise ValueError('Validation input changed during sandbox execution: ' + path.name)


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
    for entry, raw, src, oracle in prepared:
        ident = entry['id']
        (a.data / (ident + '.json')).unlink(missing_ok=True)
        pkg = json.loads(raw)
        try:
            negative = run('print(-999999999999)\n', pkg['cases'][0]['input'])
            entry['checks'].append({'name': 'incorrect constant-output rejection',
                'status': negative['status'], 'passed': negative['status'] == 'Accepted'
                and not checked(negative, pkg['cases'][0]['expectedOutput'].split())})
            v = run(src, json.dumps(oracle['args']), True)
            entry['checks'].append({'name': '120 independent small-instance oracle comparisons',
                'status': v['status'], 'passed': checked(v, oracle['expected']),
                'cpuNs': v.get('time'), 'memoryBytes': v.get('memory')})
            for case in pkg['cases']:
                v = run(src, case['input'])
                entry['checks'].append({'name': case['name'], 'status': v['status'],
                    'passed': checked(v, case['expectedOutput'].split()),
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
    for entry, raw, _, _ in prepared:
        (a.data / (entry['id'] + '.json')).write_bytes(raw)
    publish = [dict(problemId=e['id'], packageFile=e['id'] + '.json',
        packageSha256=e['packageSha256'], verified=True, sourceContentHash=e['sourceContentHash'],
        referenceSha256=e['referenceSha256'], runnerSha256=e['wrapperSha256'],
        inputBytesSha256=e['inputBytesSha256'], referenceBytesSha256=e['referenceBytesSha256'],
        oracleSha256=e['oracleSha256'],
        counts={'formal':e['formalCases'],'oracle':e['oracleCases'],'negativeControls':1},
        sourceUrl=e['sourceUrl'], sourceUrlZh=e['sourceUrlZh']) for e in report['problems']]
    (a.data / 'verified-manifest.json').write_text(json.dumps(
        {'verifiedAt':report['finishedAt'], 'sourceHashesFileSha256':report['sourceHashesFileSha256'],
         'problems':publish}, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    main()
