def solve(d):
    n,k=map(int,d[:2]);groups={}
    for i,v in enumerate(map(int,d[2:])):groups.setdefault(v,[]).append(i)
    answer=0
    for p in groups.values():
        left=0
        for right in range(len(p)):
            while p[right]-p[left]-(right-left)>=k:left+=1
            answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
