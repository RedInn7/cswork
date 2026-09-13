from math import isqrt
def solve(d):
    n,m,w=map(int,d[:3]);grid=d[3:];mod=998244353;radius=isqrt(w*w-1)
    incoming=[int(c=='X') for c in grid[-1]]
    def transfer(values,row,distance):
        prefix=[0]
        for value in values:prefix.append((prefix[-1]+value)%mod)
        return [(prefix[min(m,j+distance+1)]-prefix[max(0,j-distance)])%mod if row[j]=='X' else 0 for j in range(m)]
    for i in range(n-1,-1,-1):
        finished=incoming
        if i:incoming=transfer(finished,grid[i-1],radius)
    return str(sum(finished)%mod)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
