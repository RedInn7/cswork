def solve(d):return ' '.join(str(w//4+1 if w%2==0 else 0) for w in map(int,d[1:]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
