def solve(d):
    s=d[0];x,y=map(int,d[1:])
    if x>y:s=s[::-1];x,y=y,x
    a=list(s.replace('!','1'));left0=left1=cost=0
    for c in a:
        if c=='0':cost+=left1*y;left0+=1
        else:cost+=left0*x;left1+=1
    right0=a.count('0');right1=len(a)-right0;left0=left1=0;best=cost
    for original,c in zip(s,a):
        if c=='0':right0-=1
        else:right1-=1
        if original=='!':cost+=left1*y-left0*x+right1*x-right0*y;c='0';best=best
        if c=='0':left0+=1
        else:left1+=1
    return str(best%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
