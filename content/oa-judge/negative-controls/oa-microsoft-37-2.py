def solve(d):
    n,budget=map(int,d[:2]);distance=list(map(int,d[2:2+n]));cost=list(map(int,d[2+n:]));orders=sorted(zip(distance,cost),key=lambda x:(x[0],-x[1]));answer=0
    for _,value in orders:
        if value>budget:break
        budget-=value;answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
