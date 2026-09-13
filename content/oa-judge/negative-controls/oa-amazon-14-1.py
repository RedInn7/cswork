def solve(d):
    s,t=d; j=0
    for c in s:
        if c==t[j]: j+=1
        if j==len(t): return 'YES'
    return 'NO'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
