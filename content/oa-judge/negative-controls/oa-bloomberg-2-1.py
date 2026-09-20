def solve(d):
    q=int(d[0]);pairs=[(int(d[i]),int(d[i+1])) for i in range(1,2*q+1,2)];maximum=max(b for a,b in pairs);pre=[0]*(maximum+1)
    for x in range(1,maximum+1):
        y=x;mask=0;ok=True
        while y:
            digit=y%10
            if mask&(1<<digit):ok=False;break
            mask|=1<<digit;y//=10
        pre[x]=pre[x-1]+ok
    return '\n'.join(str(pre[b]-pre[a]) for a,b in pairs)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
