def solve(raw):
    v=list(map(int,raw.split())); n,k=v[:2]; scores=sorted(v[2:2+n],reverse=True); ans=0; rank=1
    for i,s in enumerate(scores):
        if i and s!=scores[i-1]: rank=i+1
        if rank<=k and s>0: ans+=1
    return str(ans)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
