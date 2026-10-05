import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]; i=n//2
    def bestpart(x):
        cur=best=x[0]
        for v in x[1:]: cur=max(v,cur+v); best=max(best,cur)
        return best
    return str(bestpart(a[:i])+bestpart(a[i:]))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
