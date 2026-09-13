def solve(d):
    from itertools import islice
    return str(sum(str(int(v)).count('0')%2 if int(v)!=0 else 0 for v in islice(d,1,None)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
