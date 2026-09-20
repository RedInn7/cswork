def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:];seen=bytearray(n);answer=0
    for start in range(n):
        if seen[start]:continue
        v=start;length=0
        while not seen[v]:seen[v]=1;length+=1;v=a[v]-1
        answer+=length-1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
