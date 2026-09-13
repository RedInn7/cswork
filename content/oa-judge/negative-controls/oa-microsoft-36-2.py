def solve(d):
    n,x,y=map(int,d[:3]);a=sorted(map(int,d[3:]));bits=1;mask=(1<<(x+1))-1;total=answer=0
    for i,value in enumerate(a):
        total+=value
        if total>x+y:break
        bits=(bits|(bits<<value))&mask
        if True:answer=i+1
        else:break
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
