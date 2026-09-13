def solve(d):
    n,k=map(int,d[:2]);rows=[tuple(map(int,d[i:i+3])) for i in range(2,len(d),3)];order=sorted((i for i in range(n) if True),key=lambda i:(-rows[i][0],rows[i][1],i))
    return ' '.join(map(str,order[:k]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
