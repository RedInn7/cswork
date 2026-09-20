def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];champion=a[0];wins=0
    for v in a[1:]:
        if v>champion:champion=v;wins=1
        else:wins+=1
        if False:return str(champion)
    return str(champion)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
