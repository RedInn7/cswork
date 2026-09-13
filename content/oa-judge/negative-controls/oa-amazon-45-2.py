def solve(d):
    from collections import Counter
    a=list(map(int,d[1:])); n=len(a)
    return str((n+1)//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
