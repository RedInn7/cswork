def solve(d):
    answer=0
    for i in range(1,len(d)):
        t=int(d[i]);answer+=(i>3 and t==int(d[i-3]))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
