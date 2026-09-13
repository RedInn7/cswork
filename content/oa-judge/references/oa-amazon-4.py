def solve(data):
    a=list(map(int,data[1:])); answer=abs(a[-1])
    for i in range(len(a)-1):answer+=abs(a[i]-a[i+1])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
