def solve(raw):
    from bisect import bisect_right
    def scaled(s):
        sign=-1 if s.startswith('-') else 1;s=s.lstrip('+-');a,_,b=s.partition('.')
        return sign*(int(a)*1000000+int((b+'000000')[:6]))
    tokens=iter(raw.split());n=int(next(tokens));q=int(next(tokens));points=sorted((scaled(next(tokens)),scaled(next(tokens))) for _ in range(n));xs=[p[0] for p in points];out=[]
    for _ in range(q):
        x=scaled(next(tokens));i=max(0,min(n-2,bisect_right(xs,x)-1));a,b=points[i];c,d=points[i+1];den=c-a;num=b*den+(d-b)*(x-a)
        sign='-' if num<0 else '';units,rem=divmod(abs(num),den)
        if 2*rem>=den:units+=1
        if units==0:sign=''
        whole,part=divmod(units,1000000);out.append(sign+str(whole)+'.'+str(part).zfill(6))
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
