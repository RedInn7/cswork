def solve(d):
    n,m=map(int,d[:2]);rows=list(dict.fromkeys(d[2:]));n=len(rows);groups=[0]*n;answer=[]
    for j in range(m):
        ids={};counts={};next_groups=[]
        for i in range(n):
            key=(groups[i],rows[i][j]);group=ids.setdefault(key,len(ids));next_groups.append(group);counts[group]=counts.get(group,0)+1
        groups=next_groups;answer.append(max(counts.values()))
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
