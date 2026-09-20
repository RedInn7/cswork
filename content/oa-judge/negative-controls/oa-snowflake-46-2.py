def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));p=max(range(n),key=a.__getitem__);out=[]
    for r in map(int,d[2+n:]):p=(p-r)%n;out.append(p)
    return str(m)+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
