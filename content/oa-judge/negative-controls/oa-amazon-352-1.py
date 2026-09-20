def solve(raw):
    lines=raw.splitlines();n,k=map(int,lines[0].split());s=lines[1] if n else '';rewards=list(map(int,' '.join(lines[2:]).split()));k=min(k,n)
    if not k:return '0'
    negative=-10**30;dp=[[negative]*(k+1) for _ in range(26)];best=[negative]*26
    for c,value in zip(s,rewards):
        if value<=0:continue
        index=ord(c)-65;other=max([0]+[best[j] for j in range(26) if j!=index]);row=dp[index]
        for run in range(k,1,-1):row[run]=max(row[run],row[run-1]+value)
        row[1]=max(row[1],other+value);best[index]=max(row)
    return str(max(0,max(best)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
