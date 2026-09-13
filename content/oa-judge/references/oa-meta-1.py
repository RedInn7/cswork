def solve(data):
    rows,cols=map(int,data[:2]); board=data[2:]; bottom=max(i for i in range(rows) if '*' in board[i]); distance=rows-1-bottom; answer=0
    for j in range(cols):
        diff=[0]*(rows+1)
        for i in range(rows):
            if board[i][j]=='*':diff[i+1]+=1; diff[i+distance+1]-=1
        active=0
        for i in range(rows):
            active+=diff[i]
            if active and board[i][j]=='#':answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
