def solve(d):
    from collections import Counter
    n=int(d[0]);a=list(map(int,d[1:1+n]));old=list(map(int,d[1+n:1+2*n]));new=list(map(int,d[1+2*n:]));freq=Counter(a);total=sum(a);out=[]
    for r,v in zip(old,new):
        if r!=v:
            count=freq.pop(r,0);total+=(v-r)*count+v*freq[v];freq[v]+=count
        out.append(str(total))
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
