def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:]));answer=0
    for i in range(n):
        for j in range(m):
            if a[i*m+j]:
                answer+=4
                if i and a[(i-1)*m+j]:answer-=2
                if j and a[i*m+j-1]:answer-=2
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
