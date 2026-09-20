def solve(d):
    from collections import Counter
    a=list(map(int,d[1:]));return str(len(a)-1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
