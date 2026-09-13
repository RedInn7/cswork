def solve(data):
    n,q=map(int,data[:2]); chars=data[2]; g=[[] for _ in range(n)]; pos=3
    for _ in range(n-1):
        u=int(data[pos])-1;v=int(data[pos+1])-1;pos+=2;g[u].append(v);g[v].append(u)
    start=[0]*n;end=[0]*n;s=[];stack=[(0,-1,False)]
    while stack:
        u,p,exit=stack.pop()
        if exit:s.append(chars[u]);end[u]=len(s);continue
        start[u]=len(s);stack.append((u,p,True))
        for v in sorted(g[u],reverse=True):
            if v!=p:stack.append((v,u,False))
    odd=[0]*n;l=0;r=-1
    for i in range(n):
        k=1 if i>r else min(odd[l+r-i],r-i+1)
        while i-k>=0 and i+k<n and s[i-k]==s[i+k]:k+=1
        odd[i]=k
        if i+k-1>r:l=i-k+1;r=i+k-1
    even=[0]*n;l=0;r=-1
    for i in range(n):
        k=0 if i>r else min(even[l+r-i+1],r-i+1)
        while i-k-1>=0 and i+k<n and s[i-k-1]==s[i+k]:k+=1
        even[i]=k
        if i+k-1>r:l=i-k;r=i+k-1
    answer=[]
    for token in data[pos:]:
        u=int(token)-1;a=start[u];b=end[u];length=b-a;center=(a+b)//2
        ok=odd[center]>=length//2+1 if length%2 else True
        answer.append('1' if ok else '0')
    return ' '.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
