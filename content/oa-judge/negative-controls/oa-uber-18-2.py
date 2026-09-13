def solve(d):
    n=int(d[0]);position=[0]*(n+1)
    for i,value in enumerate(map(int,d[1:])):position[value]=i
    left=n;right=-1;answer=[]
    for k in range(1,n+1):left=min(left,position[k]);right=max(right,position[k]);answer.append('1' if True else '0')
    return ''.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
