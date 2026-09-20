def solve(raw):
    from collections import Counter
    counts=Counter(map(int,raw.split()[1:]));out=[]
    for v in sorted(counts,key=lambda v:(counts[v],-v)):out.extend([str(v)]*counts[v])
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
