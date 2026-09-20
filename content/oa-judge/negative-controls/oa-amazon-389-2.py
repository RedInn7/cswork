def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];b=d[2+n:2+2*n];c=d[2+2*n:2+2*n+m];e=d[2+2*n+m:]
    first=min(x+y for x,y in zip(a,b));second=min(x+y for x,y in zip(c,e))
    return str(min(min(first+y for x,y in zip(c,e)),min(max(second,x)+y for x,y in zip(a,b))))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
