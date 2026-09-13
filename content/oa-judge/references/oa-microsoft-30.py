def solve(d):
    from bisect import bisect_left
    a=list(map(int,d[1:]));ordered=sorted(a);prefix=[0]
    for value in ordered:prefix.append(prefix[-1]+value)
    bit=[0]*(max(a)+1);answer=0
    for i,value in enumerate(a):
        index=value
        while index<len(bit):bit[index]+=1;index+=index&-index
        less=0;index=value-1
        while index:less+=bit[index];index-=index&-index
        split=bisect_left(ordered,value);before=prefix[split]+(len(a)-split)*(value-1)
        answer+=before+i+1-less
    return str(answer%1000000000)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
