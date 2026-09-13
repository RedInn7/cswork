def solve(d):
    n,k=map(int,d[:2]);first={0:0};remainder=answer=0
    for i,value in enumerate(map(int,d[2:]),1):
        remainder=(remainder+value)%k
        if remainder in first:answer=max(answer,i-first[remainder])
        else:first[remainder]=i
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
