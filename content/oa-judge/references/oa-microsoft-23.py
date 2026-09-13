def solve(d):
    n,m=map(int,d[:2]);answer=0
    for i in range((n+1)//2):
        for j in range((m+1)//2):
            cells={(i,j),(n-1-i,j),(i,m-1-j),(n-1-i,m-1-j)};black=sum(d[2+a][b]=='B' for a,b in cells)
            answer+=min(black,len(cells)-black)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
