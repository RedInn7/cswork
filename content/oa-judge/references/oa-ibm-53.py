def solve(d):
    a=sorted(map(int,d[1:]));l=0;r=len(a)-1;out=[]
    while l<=r:
        out.append(a[r]);r-=1
        if l<=r:out.append(a[l]);l+=1
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
