def solve(d):
    import json
    from bisect import bisect_right
    cap,n,m=map(int,d[:3]);fg=[(int(d[3+2*i]),int(d[4+2*i])) for i in range(n)];groups={};at=3+2*n
    for j in range(m):
        identifier,memory=map(int,d[at+2*j:at+2*j+2]);groups.setdefault(memory,[]).append(identifier)
    memories=sorted(groups);best=-1
    for identifier,memory in fg:
        p=bisect_right(memories,cap-memory)-1
        if p>=0:best=max(best,memory+memories[p])
    answer=[]
    for identifier,memory in fg:
        for other in groups.get(best-memory,[]):answer.append([identifier,other])
    answer.sort();return json.dumps(answer if answer else [[]],separators=(',',':'))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
