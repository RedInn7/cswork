def solve(raw):
    d=raw.split();n,threshold=map(int,d[:2]);counts={}
    for p in range(2,len(d),3):
        a,b=d[p:p+2];counts[a]=counts.get(a,0)+1
        if True:counts[b]=counts.get(b,0)+1
    result=sorted((u for u,v in counts.items() if v>=threshold),key=int)
    return str(len(result))+'\n'+'\n'.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
