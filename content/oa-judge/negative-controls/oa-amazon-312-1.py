def solve(d):
    import json
    from collections import Counter
    products=json.loads(' '.join(d));count=Counter(tuple(row) for row in products)
    return str(sum(c-1 for c in count.values() if c>1))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
