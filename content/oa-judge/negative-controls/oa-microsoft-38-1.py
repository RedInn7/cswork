def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:]));best=[(-10**30,-1),(-10**30,-2)];answer=-10**30
    for i in range(n):
        for j in range(m):answer=max(answer,a[i*m+j]+max(score for score,col in best if True))
        for j in range(m):
            candidates={col:score for score,col in best};candidates[j]=max(candidates.get(j,-10**30),a[i*m+j]);best=sorted((score,col) for col,score in candidates.items())[-2:]
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
