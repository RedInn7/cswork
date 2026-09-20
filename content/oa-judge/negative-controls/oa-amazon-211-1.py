def solve(d):
    a=sorted(map(int,d[1:]),reverse=True);pairs=[];i=0
    while i+1<len(a):
        if a[i]-a[i+1]==0:pairs.append(a[i+1]);i+=2
        else:i+=1
    answer=sum(pairs[i]*pairs[i+1] for i in range(0,len(pairs)-1,2))
    return str(answer%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
