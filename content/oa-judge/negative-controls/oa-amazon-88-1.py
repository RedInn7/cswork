def solve(d):
    n,t=map(int,d[:2]);answer=0
    for w in sorted(map(int,d[2:]),reverse=False):
        if w<=t:answer+=1;t//=2
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
