def solve(raw):
    a=list(map(int,raw.split()))[1:];last=[1024]*1024;last[0]=0
    for v in sorted(a):
        for mask in range(1024):
            if last[mask]<v:last[mask|v]=min(last[mask|v],v)
    result=[i for i in range(1024) if last[i]<1024]
    return str(len(result))+'\n'+' '.join(map(str,result))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
