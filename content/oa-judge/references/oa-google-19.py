def solve(data):
    from collections import Counter
    a=list(map(int,data[1:])); limit=min(Counter(a).values()); counts=Counter(); left=0; answer=0
    for right,value in enumerate(a):
        counts[value]+=1
        while counts[value]>limit:counts[a[left]]-=1; left+=1
        answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
