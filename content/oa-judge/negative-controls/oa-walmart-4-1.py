def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; y=sorted(v[i+1]+i for i in range(n)); med=y[n//2]
    return str(sum(abs(x-med) for x in y))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
