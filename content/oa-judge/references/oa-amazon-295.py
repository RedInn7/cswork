def solve(d):
    a=list(map(int,d[1:]));n=len(a);average=sum(a)//n;prefix=total=low=high=0
    for v in a:prefix+=v-average;total+=prefix;low=min(low,prefix);high=max(high,prefix)
    return str(min(total-n*low,n*high-total))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
