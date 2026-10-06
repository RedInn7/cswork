import sys
def solve(raw):
    s=raw.rstrip('\n'); n=len(s); blocks=[]; i=0
    while i<n:
        if s[i]=='.': i+=1; continue
        start=i; ch=s[i]
        while i<n and s[i]==ch: i+=1
        blocks.append([ch,start,i])
    if not blocks: return str(n*(n+1)//2)
    runs=[]
    for block in blocks:
        if runs and runs[-1][0]==block[0]: runs[-1][2]=block[2]
        else: runs.append(block[:])
    lengths=[end-start for _,start,end in runs]
    lengths[0]+=runs[0][1]
    lengths[-1]+=n-runs[-1][2]
    gaps=[runs[i+1][1]-runs[i][2] for i in range(len(runs)-1)]
    tri=lambda z:z*(z+1)//2
    if len(runs)==1: return str(tri(lengths[0]))
    # State says whether the preceding gap was assigned to this run (1) or its left neighbor (0).
    dp=[0,-10**30]
    for i,d in enumerate(gaps):
        nxt=[-10**30,-10**30]
        for prev_state in (0,1):
            base=lengths[i]+(gaps[i-1] if i>0 and prev_state==1 else 0)
            nxt[0]=max(nxt[0],dp[prev_state]+tri(base))
            nxt[1]=max(nxt[1],dp[prev_state]+tri(base))
        dp=nxt
    answer=max(dp[state]+tri(lengths[-1]+(gaps[-1] if state==1 else 0)) for state in (0,1))
    return str(answer)

print(solve(sys.stdin.read()))
