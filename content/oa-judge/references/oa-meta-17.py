def solve(data):
    n=int(data[0]); a=list(map(int,data[1:])); left=0; right=n-1
    while left<right:
        middle=(left+right)//2
        if a[middle]<a[middle+1]:left=middle+1
        else:right=middle
    return str(left)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
