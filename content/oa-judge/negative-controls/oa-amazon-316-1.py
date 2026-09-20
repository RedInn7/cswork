def solve(d):
    values=list(map(int,d[1:]));a=sorted(zip(values[::2],values[1::2]));end=a[0][1];answer=None
    for l,r in a[1:]:
        if l<end:end=max(end,r)
        else:
            gap=l-end;answer=gap if answer is None else min(answer,gap);end=r
    return '-1' if answer is None else str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
