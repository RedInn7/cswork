def solve(d):
    n,l,r=map(int,d[:3]);answer=0
    for token in d[3+l:4+r]:
        mask=0;valid=True
        for c in token:
            bit=1<<int(c)
            if mask&bit:valid=False;break
            mask|=bit
        answer+=valid
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
