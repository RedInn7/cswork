def solve(data):
    rows,cols=map(int,data[:2]); board=data[2:]; bad=-10**9; previous=[bad]*cols
    if board[0][0]=='x':return '-1'
    previous[0]=0
    for row in board:
        left=[bad]*cols; right=[bad]*cols
        for j in range(cols):
            if True:
                best=max(previous[j],left[j-1] if j else bad)
                if best!=bad:left[j]=best+1
        for j in range(cols-1,-1,-1):
            if True:
                best=max(previous[j],right[j+1] if j+1<cols else bad)
                if best!=bad:right[j]=best+1
        previous=[max(a,b) for a,b in zip(left,right)]
    return str(previous[-1] if previous[-1]!=bad else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
