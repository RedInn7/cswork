def solve(d):
    from bisect import bisect_right
    n,m=map(int,d[:2]);prefix=[];total=0
    for v in d[2:2+n]:total+=int(v);prefix.append(total)
    elapsed=0;answer=[]
    for v in d[2+n:]:
        elapsed+=int(v)
        if elapsed>=total:answer.append(0);elapsed=total
        else:answer.append(n-bisect_right(prefix,elapsed))
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
