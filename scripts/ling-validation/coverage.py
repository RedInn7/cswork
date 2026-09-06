#!/usr/bin/env python3
"""Account for every requested problem; never confuse implemented with verified/published."""
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path


def category(signature):
    result=(signature.get('return') or {}).get('type','unknown')
    params=[p.get('type','unknown') for p in signature.get('params',[])]
    if signature.get('systemdesign'):
        return 'stateful-design'
    if any('Node' in p for p in params) or 'Node' in result:
        return 'tree-or-list-codec'
    if result in ('double','double[]'):
        return 'floating-point-checker'
    if result=='void':
        return 'in-place-output-contract'
    if result in ('integer','long','boolean'):
        return 'scalar-answer'
    return 'structured-or-multiple-answer'


def valid_hash(value):
    return isinstance(value,str) and re.fullmatch(r'[a-f0-9]{64}',value) is not None


def verified_records(manifest, hashes, allowed):
    """Cross-check completed report, package identity/bytes, and current source."""
    data=json.loads(manifest.read_text())
    report=json.loads((manifest.parent/'verification-report.json').read_text())
    if (report.get('allPassed') is not True or report.get('engine')!='go-judge'
            or not report.get('finishedAt') or data.get('verifiedAt')!=report['finishedAt']
            or not valid_hash(data.get('sourceHashesFileSha256'))
            or data['sourceHashesFileSha256']!=report.get('sourceHashesFileSha256')):
        raise ValueError('Missing, incomplete, or mismatched sandbox report')
    items=data.get('problems')
    reports=report.get('problems')
    if not isinstance(items,list) or not items or not isinstance(reports,list):
        raise ValueError('Empty or invalid verification manifest')
    entries={}
    for entry in reports:
        ident=entry.get('id')
        if not isinstance(ident,str) or ident in entries:
            raise ValueError('Duplicate or invalid report identity')
        entries[ident]=entry
    seen=set()
    for item in items:
        ident=item.get('problemId')
        if (not isinstance(ident,str) or not re.fullmatch(r'lc-[1-9][0-9]*',ident)
                or ident not in allowed or ident in seen):
            raise ValueError('Unknown or duplicate verified identity')
        seen.add(ident)
        if item.get('packageFile')!=ident+'.json':
            raise ValueError('Package must have its exact problem filename beside manifest')
        path=manifest.parent/item['packageFile']
        if path.resolve().parent!=manifest.parent.resolve():
            raise ValueError('Package symlink must not escape manifest directory')
        raw=path.read_bytes()
        package=json.loads(raw)
        counts=item.get('counts',{})
        if (item.get('verified') is not True or not valid_hash(hashes.get(ident))
                or item.get('sourceContentHash')!=hashes[ident]
                or not valid_hash(item.get('packageSha256'))
                or hashlib.sha256(raw).hexdigest()!=item['packageSha256']
                or type(counts.get('formal')) is not int or not 2<=counts['formal']<=64
                or type(counts.get('oracle')) is not int or counts['oracle']<120
                or type(counts.get('negativeControls')) is not int or counts['negativeControls']<2
                or package.get('problem',{}).get('id')!=ident
                or not isinstance(package.get('cases'),list) or len(package['cases'])!=counts['formal']):
            raise ValueError('Stale or invalid verification: '+ident)
        entry=entries.get(ident,{})
        checks=entry.get('checks')
        if (entry.get('status')!='verified' or entry.get('counts')!=counts
                or not isinstance(checks,list)
                or len(checks)!=counts['formal']+counts['negativeControls']+1
                or any(c.get('passed') is not True for c in checks)):
            raise ValueError('Incomplete or failed checks for '+ident)
        for key,report_key in [('sourceContentHash','sourceContentHash'),('packageSha256','packageSha256'),
                ('referenceSha256','referenceSha256'),('runnerSha256','wrapperSha256'),
                ('inputBytesSha256','inputBytesSha256'),('referenceBytesSha256','referenceBytesSha256'),
                ('oracleSha256','oracleSha256'),('mutationSha256','mutationSha256')]:
            if not valid_hash(item.get(key)) or item[key]!=entry.get(report_key):
                raise ValueError('Report provenance mismatch: '+ident+' '+key)
        if item['inputBytesSha256']!=item['packageSha256'] or item['referenceBytesSha256']!=item['runnerSha256']:
            raise ValueError('Executed bytes differ from verified artifact: '+ident)
    if seen!=set(entries):
        raise ValueError('Report and manifest cover different problem sets')
    return seen


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--library',type=Path,required=True)
    p.add_argument('--source-hashes',type=Path,required=True)
    p.add_argument('--verified',type=Path,action='append',default=[])
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    # A failed refresh cannot leave a previous coverage file claiming completion.
    a.output.unlink(missing_ok=True)
    library=list(map(json.loads,a.library.read_text().splitlines()))
    hashes=json.loads(a.source_hashes.read_text())
    if not isinstance(hashes,dict):
        raise ValueError('Expected source hash mapping')
    allowed=set()
    for row in library:
        ident=row['id'];number=row['number']
        if type(number) is not int or number<=0 or ident!=f'lc-{number}' or ident in allowed:
            raise ValueError('Duplicate or invalid library identity')
        allowed.add(ident)
    verified={}
    for manifest in a.verified:
        for ident in verified_records(manifest,hashes,allowed):
            if ident in verified:
                raise ValueError('Problem appears in multiple verification manifests: '+ident)
            verified[ident]=str(manifest)
    rows=[dict(id=r['id'],number=r['number'],title=r['titleZh'],topics=r['topics'],
               category=category(r['signature']),
               status='sandbox-verified' if r['id'] in verified else 'needs-design-and-validation',
               verification=verified.get(r['id'])) for r in library]
    data=dict(total=len(rows),verified=len(verified),remaining=len(rows)-len(verified),
              categories=dict(Counter(r['category'] for r in rows)),problems=rows)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    temporary=a.output.with_name('.'+a.output.name+'.tmp')
    temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    temporary.replace(a.output)
    print(json.dumps({k:v for k,v in data.items() if k!='problems'},ensure_ascii=False))

if __name__=='__main__':
    main()
