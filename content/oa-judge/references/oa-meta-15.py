def solve(data):
    rows,cols=map(int,data[:2]); vals=list(map(int,data[2:])); result=[]
    for i in range(rows):
        for j in range(cols):
            v=vals[i*cols+j]
            if not v:continue
            ok=True
            for x in range(max(0,i-v),min(rows,i+v+1)):
                for y in range(max(0,j-v),min(cols,j+v+1)):
                    if (x==i and y==j) or (abs(x-i)==v and abs(y-j)==v):continue
                    if vals[x*cols+y]>=v:ok=False; break
                if not ok:break
            if ok:result.append((i,j))
    return str(len(result))+''.join(f'\n{i} {j}' for i,j in result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
