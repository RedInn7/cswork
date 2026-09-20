def solve(raw):
    from collections import Counter
    values=list(map(int,raw.split()));n=values[0];x=values[1:1+n];y=values[1+n:];best=max(Counter(x).values())
    return str(best if best>=2 else 0)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
