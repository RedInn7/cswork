def solve(d):
    a=sorted(map(int,d[1:]));total=kept=0
    for v in a:
        if v>=total:total+=v;kept+=1
    return str(len(a)-kept)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
