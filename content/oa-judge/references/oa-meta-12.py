def solve(data):
    from bisect import bisect_left
    q=int(data[0]); cursor=1; ops=[]
    for _ in range(q):
        t=int(data[cursor]); size=2 if t==1 else 3; ops.append(tuple(map(int,data[cursor:cursor+size]))); cursor+=size
    coords=sorted(o[1] for o in ops if o[0]==1); bit=[0]*(len(coords)+1); result=[]
    def prefix(i):
        total=0
        while i:total+=bit[i]; i-=i&-i
        return total
    for op in ops:
        if op[0]==1:
            i=bisect_left(coords,op[1])+1
            while i<len(bit):bit[i]+=1; i+=i&-i
        else:
            left=bisect_left(coords,op[1]); right=bisect_left(coords,op[1]+op[2])
            result.append('1' if prefix(right)==prefix(left) else '0')
    return ''.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
