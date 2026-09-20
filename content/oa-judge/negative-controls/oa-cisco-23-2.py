def solve(raw):
    from collections import Counter
    values=list(map(int,raw.split()));n=values[0];x=values[1:1+n];y=values[1+n:];best=max(max(Counter(x).values()),max(Counter(y).values()))
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
