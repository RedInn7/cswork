from collections import Counter
def solve(raw):
    a=list(map(int,raw.split()))[1:];target=min(Counter(a).values());counts={};left=answer=at=0
    for right,v in enumerate(a):
        old=counts.get(v,0)
        if old==target:at-=1
        counts[v]=old+1
        if counts[v]==target:at+=1
        while counts[v]>target:
            u=a[left]
            if counts[u]==target:at-=1
            counts[u]-=1
            if counts[u]==target:at+=1
            left+=1
        if at:answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
