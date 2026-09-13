def solve(data):
    n=int(data[0]); k=1; answer=0
    while k<=n:
        quotient=n//k; answer+=quotient; k=n//quotient+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
