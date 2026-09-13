def solve(d):
    n,m=map(int,d[:2]); columns=[0]*m; best=0
    for row in d[2:]:
        best=max(best,row.count('1'))
        for j,c in enumerate(row): columns[j]+=c=='1'
    return str(2*(best+max(columns)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
