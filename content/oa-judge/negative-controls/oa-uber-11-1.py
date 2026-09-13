def solve(d):
    from itertools import islice
    return str(sum(int('0' in str(int(v))) for v in islice(d,1,None)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
