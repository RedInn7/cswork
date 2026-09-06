"""Build display data from a PUBLIC-ONLY [{id,input,expectedOutput}] export.
Usage: python3 scripts/leetcode-mode/generate-public-samples.py public-export.json
Only reviewed repository parse snippets execute, offline. Nothing executes on requests.
Exact original strings bind each display to its public testcase; changed cases fall back.
"""
import io,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/ling-validation'))
from result_contract import format_result
contracts=json.loads((ROOT/'lib/content/leetcode-contracts.json').read_text())['problems']

def decode(kind,text):
    lines=text.splitlines(); tokens=text.split()
    if kind=='string': return text.removesuffix('\n')
    if kind in ('integer','float'): return int(text) if kind=='integer' else float(text)
    if kind.startswith('json-'): return json.loads(text)
    n=int(tokens[0])
    if kind=='string-set': result=lines[1:]
    elif kind in ('integer-rows','integer-row-set','integer-bag-row-set','integer-row-multiset'):
        it=iter(tokens[1:]);result=[[int(next(it)) for _ in range(int(next(it)))] for _ in range(n)]
        assert next(it,None) is None
    else: result=[None if t=='null' else float(t) if kind=='float-array' else int(t) for t in tokens[1:]]
    assert len(result)==n
    assert format_result(kind,result)==text, 'Noncanonical output'
    return result

def display(row,c):
    spec=c['spec'];sig=c['signature']; scope={'sys':type('Input',(),{'stdin':io.StringIO(row['input'])})(),'json':json}
    # Identity-bearing nodes and auxiliary APIs have task-specific construction
    # protocols. Show their actual protocol instead of guessing LC argument values.
    if spec.get('specialId') or spec.get('auxiliaryId') or spec.get('complexDesignId') in (297,449): return None
    exec(spec['parse'],scope)
    args=scope['args'];design=bool(spec.get('designClass') or spec.get('complexDesignId'))
    names=['operations','arguments'] if design else [p['name'] for p in sig['params']]
    assert len(names)==len(args)
    result=decode(spec['resultKind'],row['expectedOutput'])
    if spec.get('complexDesignId'): result=json.loads(result)
    if not design and sig.get('return',{}).get('type')=='boolean':
        assert result in (0,1); result=bool(result)
    if design and isinstance(result,list):
        assert len(args[0]) == len(args[1]) == len(result), 'Design result count mismatch'
        methods={m['name']:m for m in sig.get('methods',[])}
        result=[bool(v) if v is not None and methods.get(op,{}).get('return',{}).get('type')=='boolean' else v for op,v in zip(args[0],result)]
    compact=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    adapter=spec.get('resultAdapter','return')
    assert adapter in ('return','integer-rows','boolean-array','prefix-arg0','arg0','characters-arg0','matrix-arg0')
    mutated=adapter in ('prefix-arg0','arg0','characters-arg0','matrix-arg0') or spec.get('resultTree')=='arg0' or spec.get('resultLinked')=='arg0'
    if adapter=='boolean-array':
        assert all(type(v)is int and v in (0,1) for v in result)
        result=[bool(v) for v in result]
    elif adapter=='characters-arg0': result=list(result)
    elif adapter=='matrix-arg0':
        rows=len(args[0]); cols=len(args[0][0]) if rows else 0
        assert all(len(row)==cols for row in args[0]) and len(result)==rows*cols
        result=[result[i*cols:(i+1)*cols] for i in range(rows)]
    output=compact(result); output_en=output
    if adapter=='prefix-arg0':
        assert isinstance(result,list) and len(result)<=len(args[0])
        prefix=names[0]+'[0:k] = '+compact(result)
        output='返回值 k = '+str(len(result))+'\n'+prefix
        output_en='Return value k = '+str(len(result))+'\n'+prefix
    elif mutated:
        output=output_en=names[0]+' = '+compact(result)
    return {'input':'\n'.join(name+' = '+compact(value) for name,value in zip(names,args)), 'output':output, 'outputEn':output_en, 'mutated':mutated}


rows=json.loads(pathlib.Path(sys.argv[1]).read_text()); out={};fallback=[]
for row in rows:
    c=contracts.get(row['id'])
    if not c: continue
    try: rendered=display(row,c)
    except Exception as e: rendered=None;fallback.append((row['id'],str(e)))
    out.setdefault(row['id'],[]).append({'sourceInput':row['input'],'sourceOutput':row['expectedOutput'],**(rendered or {})})
assert len(out)==500, f'Expected 500 selected problems, got {len(out)}'
(ROOT/'lib/content/leetcode-public-samples.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print('Problems:',len(out),'samples:',sum(map(len,out.values())),'converted:',sum('input'in r for rs in out.values() for r in rs));print('Unsupported:',fallback)
