def solve(d):
    rank={c:i for i,c in enumerate(d[0])};values=['' if s=='-' else s for s in d[2:]]
    values.sort(key=lambda s:bytes(rank[c] for c in s))
    return ' '.join(s or '-' for s in values)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
