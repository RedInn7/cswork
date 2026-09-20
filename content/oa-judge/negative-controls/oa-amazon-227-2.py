def solve(d):
    from collections import Counter
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));answer=0
    for start in range(min(k,n)):
        group=a[start:start+1];freq=Counter(group)
        if len(freq)>1:answer+=len(group)-max([0]+[count for value,count in freq.items() if value>0])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
