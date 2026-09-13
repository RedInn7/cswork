def solve(d):
    a=list(map(int,d[1:]));order=sorted(range(len(a)),key=lambda i:(-a[i],-i));result=[0]*len(a);previous=10**9+1
    for i in order:previous=min(a[i],previous-1);result[i]=previous
    return ' '.join(map(str,result))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
