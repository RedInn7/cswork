def solve(data):
    a=list(map(int,data[1:]));total=sum(a);answer=abs(total)
    for value in a:answer=min(answer,abs(total-2*value))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
