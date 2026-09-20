def solve(raw):
    d=list(map(int,raw.split()));a=list(zip(d[1::2],d[2::2]));spent=answer=0
    for w,e in sorted(a,key=lambda p:p[0]-p[1],reverse=True):
        answer=max(answer,spent+w);spent+=e
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
