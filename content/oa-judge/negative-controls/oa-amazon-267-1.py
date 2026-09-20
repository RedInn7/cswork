def solve(d):
    n=int(d[0]);p=list(map(int,d[1:1+n]));unit=d[1+n];dp={0:0}
    for i,c in enumerate(unit):
        nxt={}
        for previous,value in dp.items():
            for move in ((False,True) if c=='1' and i else (False,)):
                stay=int(c=='1' and not move);score=value+(p[i-1]*(previous+move) if i else 0);nxt[stay]=max(nxt.get(stay,-1),score)
        dp=nxt
    return str(max(value+(p[-1] if stay else 0) for stay,value in dp.items()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
