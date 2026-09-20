def solve(d):
    import json
    from decimal import Decimal
    a,b=[json.loads(line,parse_int=Decimal,parse_float=Decimal) for line in d.split('\n')[:2]]
    def equal(x,y):
        if type(x) is not type(y) and not isinstance(x,(bool,Decimal)):return False
        if isinstance(x,dict):return x.keys()==y.keys() and all(equal(x[k],y[k]) for k in x)
        if isinstance(x,list):return len(x)==len(y) and all(equal(u,v) for u,v in zip(x,y))
        return x==y
    keys=[]
    for k in a.keys()|b.keys():
        if k not in a or k not in b or not equal(a[k],b[k]):keys.append(k)
    return json.dumps(sorted(keys),ensure_ascii=False)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
