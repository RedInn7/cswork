def solve(d):
    s=d[0];x,y=map(int,d[1:])
    if x>y:s=s[::-1];x,y=y,x
    filled=s.replace('!','1');zero=one=cost=0
    for c in filled:
        if c=='0':cost+=one*y;zero+=1
        else:cost+=zero*x;one+=1
    right0=zero;right1=one;left0=left1=0;best=cost
    for original,c in zip(s,filled):
        if c=='0':right0-=1
        else:right1-=1
        if original=='!':cost+=left1*y-left0*x;c='0';best=min(best,cost)
        if c=='0':left0+=1
        else:left1+=1
    return str(best%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
