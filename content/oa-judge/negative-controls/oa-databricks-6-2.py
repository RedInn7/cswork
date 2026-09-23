def solve(data):
    from bisect import bisect_left
    v=list(map(int,data.split())); q=v[0]; p=1; ops=[]; coords=[]
    for _ in range(q):
        kind=v[p]; size=2 if kind==1 else 3; op=tuple(v[p:p+size]); p+=size; ops.append(op)
        if kind==1: coords.append(op[1])
    coords.sort(); bit=[0]*(len(coords)+1)
    def prefix(i):
        total=0
        while i: total+=bit[i]; i-=i&-i
        return total
    out=[]
    for op in ops:
        if op[0]==1:
            i=bisect_left(coords,op[1])+1
            while i<len(bit): bit[i]+=1; i+=i&-i
        else:
            _,x,size=op; left=bisect_left(coords,x-size+1); right=bisect_left(coords,x)
            out.append('1' if prefix(right)==prefix(left) else '0')
    return ''.join(out)

if __name__=='__main__':
 import sys
 print(solve(sys.stdin.read()))
