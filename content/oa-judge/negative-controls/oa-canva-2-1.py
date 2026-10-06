def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]; b=sorted(a)
    return str(sum(a[i]>a[i+1] for i in range(n-1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
