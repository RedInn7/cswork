from bisect import bisect_left
def solve(d):
    q=int(d[0]);ops=[];i=1
    for _ in range(q):
        kind=int(d[i]);length=2 if kind==1 else 3;ops.append(tuple(map(int,d[i:i+length])));i+=length
    coordinates=sorted({op[1] for op in ops if op[0]==1});tree=[0]*(len(coordinates)+1);seen=set();answer=[]
    def prefix(end):
        result=0
        while end:result+=tree[end];end-=end&-end
        return result
    for op in ops:
        if op[0]==1:
            if op[1] in seen:continue
            seen.add(op[1]);index=bisect_left(coordinates,op[1])+1
            while index<len(tree):tree[index]+=1;index+=index&-index
        else:
            left=bisect_left(coordinates,op[1]-op[2]);right=bisect_left(coordinates,op[1]+1);answer.append('1' if prefix(right)==prefix(left) else '0')
    return ''.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
