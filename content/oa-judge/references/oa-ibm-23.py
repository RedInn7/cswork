def solve(d):
    even=0;odd=None
    for v in map(int,d[1:]):
        if v%2:even,odd=max(even,odd+v if odd is not None else even),max(odd if odd is not None else v,even+v)
        else:even,odd=max(even,even+v),None if odd is None else max(odd,odd+v)
    return str(even)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
