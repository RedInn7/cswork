def solve(raw):
    from collections import Counter
    a=list(map(int,raw.split()))[1:];n=len(a);f=max(Counter(a).values())
    return str(2*f-n)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
