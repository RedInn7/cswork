def solve(raw):
    a=list(map(int,raw.split()))[1:];lowest=None;answer=0
    for value in a:
        if lowest is not None:answer=max(answer,value-lowest)
        lowest=value if lowest is None else min(lowest,value)
    return str(max(a)-min(a) if a else 0)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
