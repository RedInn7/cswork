def solve(d):
    n,q=map(int,d[:2]);table={};pos=2
    for _ in range(n):
        t,k,v=d[pos:pos+3];pos+=3;table[(t,k)]=v
    out=[]
    for _ in range(q):
        k,t=d[pos:pos+2];pos+=2;out.append(table[(t,k)])
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
