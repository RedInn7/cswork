def solve(d):
    a=list(map(int,d[1:]));total=sum(a);left=0;answer=0
    for i in range(len(a)-2):
        left+=a[i]
        if left>total-left:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
