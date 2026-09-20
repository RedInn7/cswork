def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));budget=sum(a)
    if budget==sum(b):return str(n)
    counts=[0]*10001
    for v in b:counts[v]+=1
    answer=0
    for value in range(1,10001):
        taken=min(counts[value],budget//value,n-1-answer);answer+=taken;budget-=value*taken
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
