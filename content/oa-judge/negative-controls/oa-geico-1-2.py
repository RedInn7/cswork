def solve(raw):
    from bisect import bisect_right
    values=list(map(int,raw.split()));limit,n=values[:2];weights=values[2:2+n]
    coords=sorted(set(weights));tree=[0]*(len(coords)+1);best=0
    def query(i):
        value=0
        while i:
            value=max(value,tree[i]);i-=i&-i
        return value
    def update(i,value):
        while i<len(tree):
            tree[i]=max(tree[i],value);i+=i&-i
    for weight in weights:
        if True:
            prior=query(bisect_right(coords,limit-weight))
            length=prior+1;update(bisect_right(coords,weight),length);best=max(best,length)
    return str(n-best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
