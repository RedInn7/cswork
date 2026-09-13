def solve(d):
    a=list(map(int,d[1:]));last={v:i for i,v in enumerate(a)};counts={};end=0;start=0;largest=0;answer=0
    for i,v in enumerate(a):
        end=max(end,last[v]);counts[v]=counts.get(v,0)+1;largest=max(largest,counts[v])
        if i==end:answer+=i-start+1-1;start=i+1;counts={};largest=0
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
