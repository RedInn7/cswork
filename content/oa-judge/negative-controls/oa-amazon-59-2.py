def solve(d):
    n,p,q,budget=map(int,d[:4]);costs=sorted((int(v)%(p+q))//p for v in d[4:]);answer=0
    for c in costs:
        if c>budget:break
        budget-=c;answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
