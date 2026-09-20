def solve(d):
    from bisect import bisect_left,bisect_right
    values=list(map(int,d[1:]));a=list(zip(values[::2],values[1::2]));starts=sorted(l for l,r in a);ends=sorted(r for l,r in a);best=0
    for l,r in a:best=max(best,bisect_right(starts,r)-bisect_left(ends,l))
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
