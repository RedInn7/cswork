import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
    def bestpart(x):
        cur=best=0
        for v in x: cur=max(0,cur+v); best=max(best,cur)
        return best
    return str(max(bestpart(a[:i])+bestpart(a[i:]) for i in range(1,n)))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
