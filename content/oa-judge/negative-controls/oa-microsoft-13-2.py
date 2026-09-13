def solve(d):
    rows,cols=map(int,d[:2]);board=d[2:];seen=bytearray(rows*cols*4);clean=bytearray(rows*cols);i=j=direction=answer=0;moves=((0,1),(1,0),(0,-1),(-1,0))
    while not seen[(i*cols+j)*4+direction]:
        seen[(i*cols+j)*4+direction]=1
        if not clean[i*cols+j]:clean[i*cols+j]=1;answer+=1
        di,dj=moves[direction];a,b=i+di,j+dj
        if 0<=a<rows and 0<=b<cols and board[a][b]=='.':i,j=a,b
        else:direction=(direction-1)%4
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
