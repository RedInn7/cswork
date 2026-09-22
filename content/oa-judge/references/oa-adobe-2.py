def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];buckets=[0]*101
    for v in d[2:]:buckets[v]+=1
    higher=0;answer=0
    for score in range(100,0,-1):
        if higher+1<=k:answer+=buckets[score]
        higher+=buckets[score]
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
