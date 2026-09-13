def solve(d):
    a=list(map(int,d[1:])); v=max(a); freq=[0]*(2*v+1)
    for value in a: freq[value]+=1
    answer=0
    for t in range(1,2*v+1):
        count=freq[t]
        for x in range(max(1,t-v),min(v,(t-1)//2)+1): count+=min(freq[x],freq[t-x])
        if t%2==0: count+=freq[t//2]
        answer=max(answer,count)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
