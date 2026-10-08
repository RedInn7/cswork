import sys

def solve(raw):
    data=list(map(int,raw.split()))
    n=data[0]
    middle=n//2
    inside=[0]*3
    outside=[0]*3
    for i in range(n):
        for j in range(n):
            on_shape=(i<=middle and (j==i or j==n-1-i)) or (i>=middle and j==middle)
            target=inside if on_shape else outside
            target[data[1+i*n+j]]+=1
    kept=max(inside[a]+outside[b] for a in range(3) for b in range(3) if a!=b)
    return str(n*n-kept)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
