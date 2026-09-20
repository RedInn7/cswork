def solve(raw):
    from io import StringIO
    stream=StringIO(raw);n,m=map(int,stream.readline().split());columns=[10**30]*m;row_limit=10**30
    for _ in range(n):
        largest=0
        for j,value in enumerate(map(int,stream.readline().split())):largest=max(largest,value);columns[j]=min(columns[j],value)
        row_limit=min(row_limit,largest)
    answer=max(columns)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
