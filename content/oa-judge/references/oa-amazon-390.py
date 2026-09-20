def solve(raw):
    import re
    text=raw.strip();letter=next((c for c in text if c.isalpha()),'x')
    pattern=re.compile(r'([+-]?)(?:(\d+)([a-zA-Z])?|([a-zA-Z]))(?:\^([+-]?\d+))?')
    def parse(s):
        out={};pos=0
        while pos<len(s):
            m=pattern.match(s,pos);sign,digits,v1,v2,exponent=m.groups();c=int(digits) if digits is not None else 1
            if sign=='-':c=-c
            e=int(exponent) if exponent is not None else (1 if v1 or v2 else 0)
            out[e]=out.get(e,0)+c;pos=m.end()
        return out
    p,q=text[1:-1].split(')(');a=parse(p);b=parse(q);out={}
    for e,c in a.items():
        for f,d in b.items():out[e+f]=out.get(e+f,0)+c*d
    answer=[]
    for e in sorted(out,reverse=True):
        c=out[e]
        if c==0:continue
        v=abs(c);body=str(v) if e==0 else ('' if v==1 else str(v))+letter+('' if e==1 else '^'+str(e))
        answer.append(('-' if c<0 else ('+' if answer else ''))+body)
    return ''.join(answer) or '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
