def solve(d):
    from collections import Counter
    n,m=map(int,d[:2]);real=d[2:2+n];counts=Counter(''.join(sorted(s)) for s in d[2+n:]);out=sorted(s for s in real if counts[''.join(sorted(s))]>1)
    return ' '.join(out) if out else 'None'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
