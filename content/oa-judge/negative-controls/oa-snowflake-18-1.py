def solve(d):
    values=list(map(int,d[1:]));intervals=list(zip(values[::2],values[1::2]));a=b=-1;answer=0
    if any(l==r for l,r in intervals):return '-1'
    for l,r in sorted(intervals,key=lambda x:(x[1],-x[0])):
        if l>=b:a,b=r-1,r;answer+=2
        elif l>a:a,b=b,r;answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
