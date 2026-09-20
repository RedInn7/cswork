from bisect import bisect_left,bisect_right
VALID=None
def solve(raw):
    global VALID
    if VALID is None:
        VALID=[]
        def visit(v,mask):
            if v:VALID.append(v)
            for d in range(10):
                if (not v and not d) or mask>>d&1:continue
                w=v*10+d
                if w<=1000000:visit(w,mask|1<<d)
        visit(0,0);VALID.sort()
    d=list(map(int,raw.split()))[1:]
    return '\n'.join(str(bisect_left(VALID,h)-bisect_left(VALID,l)) for l,h in zip(d[::2],d[1::2]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
