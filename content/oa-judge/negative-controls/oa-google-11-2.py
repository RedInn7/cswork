def solve(data):
    n,m=map(int,data[:2]);v=list(map(int,data[2:]));targets=sorted(zip(v[:2*n:2],v[1:2*n:2]));sat=sorted(zip(v[2*n::2],v[2*n+1::2]));end=-10**30;index=answer=0
    for left,right in targets:
        if end>=right:continue
        point=max(left,end)
        while point<right:
            far=point
            while index<m and sat[index][0]<=point:
                far=max(far,sat[index][1]);index+=1
            if far<=point:return '-1'
            answer+=1;end=far;point=far
    return str(n)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
