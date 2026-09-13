def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));gaps=sorted(max(0,v-w) for w,v in zip(a,b));answer=0
    for gap in reversed(gaps):
        if gap>q:break
        q-=gap;answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
