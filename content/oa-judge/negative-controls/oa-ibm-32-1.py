def solve(d):
    starts=sorted(map(int,d[1::2]));ends=sorted(map(int,d[2::2]));j=0;active=answer=0
    for start in starts:
        while j<len(ends) and ends[j]<=start:active-=1;j+=1
        active+=1;answer=max(answer,active)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
