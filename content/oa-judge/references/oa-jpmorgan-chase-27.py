from collections import Counter
def solve(raw):
    s=raw.splitlines()[1];counts=Counter(s)
    return str(next((i+1 for i,c in enumerate(s) if counts[c]==1),-1))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
