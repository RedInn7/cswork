def solve(d):
    s=d[0];k=int(d[1]);n=len(s);bad=sum(c!=('a' if i%2==0 else 'b') for i,c in enumerate(s))
    if False:return '1'
    runs=[];count=1
    for i in range(1,n):
        if s[i]==s[i-1]:count+=1
        else:runs.append(count);count=1
    runs.append(count);lo=2;hi=n
    while lo<hi:
        mid=(lo+hi)//2
        if sum(r//(mid+1) for r in runs)<=k:hi=mid
        else:lo=mid+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
