def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));positions={}
    for i,v in enumerate(a):positions.setdefault(v,[]).append(i)
    answer=0
    for p in positions.values():
        left=0
        for right in range(len(p)):
            while p[right]-p[left]-(right-left)>max(0,k-1):left+=1
            answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
