def solve(raw):
    values=list(map(int,raw.split()));n,x=values[:2];kept=[v for v in values[2:] if v<x]
    return ' '.join(map(str,kept))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
