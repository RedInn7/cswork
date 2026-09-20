def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];b=d[2+n:];prefixes=set()
    for v in a:
        while v:prefixes.add(v);v//=10
    answer=0
    for v in b:
        while v:
            if v in prefixes:answer=max(answer,len(str(v)))
            v//=10
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
