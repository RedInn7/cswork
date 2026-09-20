def solve(d):
    a=list(map(int,d[1:]));b=sorted(a);total=0;threshold=b[0]
    for v in b:
        if total<v:threshold=v
        total+=v
    return ' '.join(str(i+1) for i,v in enumerate(a) if v>=threshold)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
