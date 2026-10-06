def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]; b=sorted(set(a))
    return str(sum(x!=y for x,y in zip(a,b)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
