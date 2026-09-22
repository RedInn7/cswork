def solve(raw):
    it=iter(map(int,raw.split()));p=next(it);n=next(it);best=[None]*p
    for _ in range(n):
        i=next(it);v=next(it)
        if best[i] is None or v<best[i]:best[i]=v
    return str(sum(v for v in best if v is not None))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
