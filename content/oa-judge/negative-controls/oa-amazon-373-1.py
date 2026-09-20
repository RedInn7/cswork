def solve(raw):
    from collections import Counter
    a=list(map(int,raw.split()))[1:];n=len(a);f=max(Counter(a).values())
    return str(n%2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
