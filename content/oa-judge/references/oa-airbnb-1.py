def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];k=d[-1];p=1;left=0;answer=0
    for right,v in enumerate(a):
        p*=v
        while left<=right and p>k:p//=a[left];left+=1
        answer+=right-left+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
