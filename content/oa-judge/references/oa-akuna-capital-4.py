import sys

def solve(raw):
    data=list(map(int,raw.split()))
    n,m,k=data[:3]
    values=data[3:3+n]
    neighbors=[[] for _ in range(n)]
    for i in range(3+n,len(data),2):
        u,v=data[i:i+2]
        if values[v]>0: neighbors[u].append(values[v])
        if values[u]>0: neighbors[v].append(values[u])
    answer=max(values)
    for center in range(n):
        neighbors[center].sort(reverse=True)
        answer=max(answer,values[center]+sum(neighbors[center][:k]))
    return str(answer)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
