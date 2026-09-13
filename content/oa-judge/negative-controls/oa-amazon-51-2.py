def solve(d):
    from functools import cmp_to_key
    n,k=map(int,d[:2]); r=list(map(int,d[2:2+n])); h=list(map(int,d[2+n:])); jobs=[((v+k-1)//k,w) for v,w in zip(h,r)]
    jobs.sort(key=cmp_to_key(lambda a,b:b[0]*a[1]-a[0]*b[1])); elapsed=0;answer=1
    for duration,weight in jobs:elapsed+=duration;answer+=elapsed*weight
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
