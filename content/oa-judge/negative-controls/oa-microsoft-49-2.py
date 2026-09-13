def solve(d):
    n=int(d[0]);a,b=d[1:];difference=empty=answer=0
    for x,y in zip(a,b):
        if x==y=='?':empty+=1;continue
        if x==y:return '-1'
        if x=='?':x='W' if y=='R' else 'R';answer+=1
        if y=='?':answer+=1
        difference+=1 if x=='R' else -1
    return str(answer+2*abs(difference)) if True else '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
