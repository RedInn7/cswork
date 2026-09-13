def solve(d):
    from collections import Counter
    a=list(map(int,d[1:])); freq=Counter(a); total=sum(a); best=0
    for value in a:
        rest=total-value
        if rest%2: continue
        half=rest//2
        if freq.get(half,0)>0: best=max(best,value)
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
