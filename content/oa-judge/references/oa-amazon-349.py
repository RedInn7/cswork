def solve(raw):
    n=int(raw);k=1;answer=0
    while k<=n:
        q=n//k;answer+=q;k=n//q+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
