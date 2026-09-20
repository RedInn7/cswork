def solve(raw):
    values=list(map(int,raw.split()));n,m=values[:2];a=values[2:];top=left=0;bottom=n-1;right=m-1;index=0;answer=a[0]
    def visit(r,c):
        nonlocal index,answer
        if index%2==1:answer=a[r*m+c]
        index+=1
    while top<=bottom and left<=right:
        for r in range(top,bottom+1):visit(r,left)
        left+=1
        for c in range(left,right+1):visit(bottom,c)
        bottom-=1
        if left<=right:
            for r in range(bottom,top-1,-1):visit(r,right)
            right-=1
        if top<=bottom:
            for c in range(right,left-1,-1):visit(top,c)
            top+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
