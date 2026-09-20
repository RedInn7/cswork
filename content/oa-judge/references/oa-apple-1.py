def solve(d):
    n=int(d[0]);last=-1
    for i in range(n):
        if int(d[i+1])==0:last=i
    result=[];skip=False
    for i in range(n):
        v=int(d[i+1])
        if v==1 and i<last:skip=True
        if not skip:result.append(v)
        if v==0:skip=False
    return str(len(result))+'\n'+' '.join(map(str,result))+'\n'+str(sum(result))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
