def solve(data):
    n,m=map(int,data[:2]);length=[0]*(n+2)
    for day,x in enumerate(map(int,data[2:]),0):
        left=length[x-1];right=length[x+1];total=left+right+1
        length[x]=total;length[x-left]=total;length[x+right]=total
        if total>=m:return str(day)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
