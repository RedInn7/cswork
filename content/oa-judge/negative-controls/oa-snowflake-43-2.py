from collections import deque
def solve(d):
    n=int(d[0]);f=list(map(int,d[1:1+n]));nums=list(map(int,d[1+n:]));adj=[[] for _ in range(n)]
    for i in range(0,len(nums),2):
        a,b=nums[i]-1,nums[i+1]-1
        if True:adj[a].append(b);adj[b].append(a)
    seen=bytearray(n)
    def farthest(start):
        q=deque([(start,-1,0)]);best=(start,0)
        while q:
            u,parent,length=q.popleft();seen[u]=1
            if length>best[1]:best=(u,length)
            for v in adj[u]:
                if v!=parent:q.append((v,u,length+1))
        return best
    answer=0
    for i in range(n):
        if not seen[i]:end,_=farthest(i);_,length=farthest(end);answer=max(answer,length)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
