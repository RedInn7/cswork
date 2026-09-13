def solve(d):
    n,a,b,budget=map(int,d[:4]);cost=sorted(((int(v)-1)%(a+b))//a for v in d[4:]);answer=0
    for value in reversed(cost):
        if value>budget:break
        budget-=value;answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
