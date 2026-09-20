def solve(d):
    n=int(d[0]);pages=list(map(int,d[1:1+n]));threshold=list(map(int,d[1+n:]));groups={}
    for p,t in zip(pages,threshold):groups.setdefault(t,[]).append(p)
    answer=0
    for t,values in groups.items():answer+=sum(sorted(values,reverse=True)[:t+1])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
