def solve(raw):
    d=list(map(int,raw.split()));n=d[0];parent=d[1:n+1];sub=d[n+1:]
    for i in range(n-1,0,-1):sub[parent[i]]+=sub[i]
    total=sub[0];return str(min(abs(total-2*v) for v in sub[1:]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
