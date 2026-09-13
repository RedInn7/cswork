def solve(d):
    n,k,m=map(int,d[:3]);a=list(map(int,d[3:]));answer=0
    for b in range(30,-1,-1):
        mask=answer|(1<<b);costs=[]
        for x in a:
            missing=mask&~x
            if not missing:costs.append(0);continue
            bit=missing.bit_length()-1
            y=((x>>(bit+1))<<(bit+1))|(1<<bit)|(mask&((1<<bit)-1))
            costs.append(y-x)
        costs.sort()
        if sum(costs[:m])<=k:answer=mask
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
