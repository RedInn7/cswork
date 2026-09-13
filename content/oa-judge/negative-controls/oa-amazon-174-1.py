def solve(d):
    last={};answer=10**30
    for i,token in enumerate(d[1:]):
        v=int(token)
        if v in last:answer=min(answer,i-last[v]+1)
        last[v]=i
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
