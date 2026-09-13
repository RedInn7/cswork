def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));total=sum(a)
    if total!=sum(b) or total%2:return '0'
    left=right=answer=0
    for i in range(n-1):
        left+=a[i];right+=b[i]
        if left==right:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
