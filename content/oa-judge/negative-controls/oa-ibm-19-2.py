def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));i=0;answer=0
    while i<n:
        j=i+1
        while j<n and a[j]==a[i]:j+=1
        answer=max(answer,j-i+n-j);i=j
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
