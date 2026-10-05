def solve(raw):
    v=list(map(int,raw.split())); n,target=v[:2]; a=v[2:2+n]
    if target<0 or target%2: return '0'
    radius=target//2
    le=sum(abs(x)<=radius for x in a)
    lt=sum(abs(x)<radius for x in a)
    return str(le*(le-1)//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
