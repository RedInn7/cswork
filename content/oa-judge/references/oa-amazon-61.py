def solve(d):
    from array import array
    n=int(d[0]);position=array('i',[0])*(n+1)
    for i in range(1,n+1):position[int(d[i])]=i
    return str(1+sum(position[v+1]<position[v] for v in range(1,n)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
