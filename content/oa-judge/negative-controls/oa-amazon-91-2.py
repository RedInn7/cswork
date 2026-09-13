def solve(d):
    s=d[0];x,y=map(int,d[1:])
    if x>y:s=s[::-1];x,y=y,x
    t=s.replace('!','1');zero=one=cost=0
    for c in t:
        if c=='0':cost+=0;zero+=1
        else:cost+=zero*x;one+=1
    best=cost;left0=left1=0;right0=zero;right1=one
    for c in s:
        if c=='0':right0-=1;left0+=1
        elif c=='1':right1-=1;left1+=1
        else:
            right1-=1;cost+=left1*y+right1*x-left0*x-right0*y
            left0+=1;best=min(best,cost)
    return str(best%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
