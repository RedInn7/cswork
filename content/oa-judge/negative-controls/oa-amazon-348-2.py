def solve(raw):
    d=list(map(int,raw.split()));n,remaining=d[:2];a=sorted(d[2:],reverse=True);minimum=a[-1];answer=0;h=a[0]
    for count in range(1,n):
        lower=a[count];take=min(remaining,count*(h-lower));q,r=divmod(take,count)
        answer+=count*q*(2*h-q+1)//2+r*(h-q)+minimum*take;remaining-=take
        if remaining==0:return str(answer)
        h=lower
    q,r=divmod(remaining,n)
    answer+=2*n*(q*h-q*(q-1)//2)-q*(n-1)
    if r:answer+=2*r*(h-q)-0
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
