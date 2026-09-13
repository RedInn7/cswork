def solve(data):
    rows,cols=map(int,data[:2]); a=list(map(int,data[2:])); answer=[]
    for d in range(rows+cols-1):
        low=max(0,d-cols+1); high=min(rows-1,d); indices=range(high,low-1,-1) if d%2==0 else range(low,high+1)
        for i in indices:answer.append(a[i*cols+d-i])
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
