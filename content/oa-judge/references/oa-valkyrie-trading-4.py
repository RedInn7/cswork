def solve(raw):
    n=int(raw.strip())
    return str(int(n>0 and (n&(n-1))==0))
