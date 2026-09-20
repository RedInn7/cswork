def solve(raw):
    data=iter(map(int,raw.split()));n=next(data);left=next(data);a=sorted((v for v in data if v>0),reverse=True)
    if not a or not left:return '0'
    low=a[-1];answer=0;c=1;h=a[0]
    while c<len(a) and left:
        nxt=a[c];take=min(left,c*(h-nxt));q,r=divmod(take,c)
        answer+=c*q*(2*h-q+1)//2+r*(h-q)+take*low;left-=take
        if take<c*(h-nxt):return str(answer)
        h=nxt;c+=1
    take=min(left,c*(h-1));q,r=divmod(take,c)
    answer+=q*c*2*h
    if r:answer+=2*(h-q)+(r-1)*(2*(h-q)-1)
    left-=take;answer+=2*left
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
