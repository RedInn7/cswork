def solve(data):
    n,m=map(int,data[:2]);friends=[set() for _ in range(n)];v=list(map(int,data[2:]))
    for i in range(0,len(v),2):
        a,b=v[i]-1,v[i+1]-1;friends[a].add(b);friends[b].add(a)
    answer=[]
    for i in range(n):
        counts={};own=friends[i]
        for middle in own:
            for candidate in friends[middle]:
                if candidate!=i and candidate not in own:counts[candidate]=counts.get(candidate,0)+1
        if counts:best=min(counts,key=lambda j:(-counts[j],j))
        else:
            best=0
            while best<n and (best==i or best in own):best+=1
        answer.append(best+1 if best<n else -1)
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
