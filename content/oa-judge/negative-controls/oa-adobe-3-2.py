def solve(raw):
    import json
    from decimal import Decimal
    first,second=raw.split('\n')[:2];cur=json.loads(first,parse_int=Decimal,parse_float=Decimal);path=json.loads(second)
    for key in path.split('.')[:1]:
        if not isinstance(cur,dict) or key not in cur:cur=None;break
        cur=cur[key]
    def encode(v):
        if v is None:return 'null'
        if v is True:return 'true'
        if v is False:return 'false'
        if isinstance(v,Decimal):
            if not v:return '0'
            s=format(v,'f');return s.rstrip('0').rstrip('.') if '.' in s else s
        if isinstance(v,str):return json.dumps(v,ensure_ascii=True)
        if isinstance(v,list):return '['+','.join(encode(w) for w in v)+']'
        return '{'+','.join(json.dumps(k,ensure_ascii=True)+':'+encode(v[k]) for k in sorted(v))+'}'
    return encode(cur)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
