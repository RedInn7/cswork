def solve(d):
    out=[]
    for i in range(1,len(d),6):
        x,y,r,a,b,s=map(int,d[i:i+6]);v=(x-a)**2+(y-b)**2
        if v==0:out.append('Concentric')
        elif v==(r+s)**2:out.append('Touching')
        elif v>(r+s)**2:out.append('Disjoint-Outside')
        elif v<(r-s)**2:out.append('Disjoint-Inside')
        else:out.append('Intersecting')
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
