def solve(d):
    q=int(d[0]);out=[]
    for i in range(q):
        n,m,s,u=map(int,d[1+4*i:5+4*i]);out.append((m+n*s)//(u+s))
    return str(q)+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
