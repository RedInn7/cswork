def solve(d):
    n,q=map(int,d[:2]);table={};p=2
    for _ in range(n):
        t,k,v=d[p:p+3];table[k,t]=v;p+=3
    out=[]
    for _ in range(q):
        k,t=d[p:p+2];out.append(table[k,t]);p+=2
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
