def solve(raw):
    d=list(map(int,raw.split()));n=d[0];capacity=d[1:n+1];loads=sorted(d[n+1:],reverse=False)
    order=sorted(range(n),key=lambda i:(capacity[i],-i));out=[0]*n
    for i,v in zip(order,loads):out[i]=v
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
