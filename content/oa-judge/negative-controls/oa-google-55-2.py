def solve(data):
    a=list(map(int,data[1:]));limit=a[-1];answer=0
    for i in range(len(a)-2,-1,-1):
        value=a[i];parts=max(1,(value+limit-1)//limit);answer+=parts-1;limit=(value+parts-1)//parts
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
