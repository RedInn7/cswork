def solve(d):
    n,k=map(int,d);p=[1]+[0]*k
    for _ in range(n):p=[sum(p)*21%1000000007]+[p[j-1]*5*int(j<k)%1000000007 for j in range(1,k+1)]
    return str(sum(p)%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
