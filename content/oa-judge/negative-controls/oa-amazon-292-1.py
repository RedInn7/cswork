def solve(d):
    a=list(map(int,d[1:]));limit=max(a);count=[0]*(limit+1)
    for v in a:count[v]+=1
    smallest=[0]*(limit+1)
    for divisor in range(1,limit+1):
        if count[divisor]:
            for multiple in range(divisor,limit+1,divisor):
                if not smallest[multiple]:smallest[multiple]=divisor
    return str(len(a)*min(a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
