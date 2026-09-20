def solve(raw):
    a=list(map(int,raw.split()))[1:];total=sum(a);prefix=0;best=total
    for v in a[:-1]:
        prefix+=v;best=min(best,abs(2*prefix-total))
    return str(abs(2*sum(a[:len(a)//2])-total))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
