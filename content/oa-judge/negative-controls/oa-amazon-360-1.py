def solve(raw):
    d=list(map(int,raw.split()));n,k,limit=d[:3];a=sorted(d[3:]);i=answer=0
    while i+k<=n:
        if a[i+k-1]-a[i]<limit:answer+=1;i+=k
        else:i+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
