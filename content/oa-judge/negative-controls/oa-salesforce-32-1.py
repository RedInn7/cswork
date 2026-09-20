def solve(raw):
    s,amount=raw.split();k=int(amount);mismatch=sum(int(ch)!=(i%2) for i,ch in enumerate(s))
    if min(mismatch,len(s)-mismatch)<=k:return '1'
    runs=[];length=0;last=None
    for ch in s:
        if ch==last:length+=1
        else:
            if length:runs.append(length)
            length=1;last=ch
    runs.append(length);lo=2;hi=max(runs)
    while lo<hi:
        mid=(lo+hi)//2
        if sum(r//(mid+1) for r in runs)<=k:hi=mid
        else:lo=mid+1
    return str(max(runs))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
