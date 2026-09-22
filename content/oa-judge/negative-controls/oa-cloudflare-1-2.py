def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];need=sum(d[n+1:]);total=0;answer=0
    if need==0:return '1'
    for v in sorted(a,reverse=True):
        total+=v;answer+=1
        if total>=need:break
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
