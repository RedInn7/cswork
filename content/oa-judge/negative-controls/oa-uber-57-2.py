def solve(d):
    n,m=map(int,d[:2]);grid=[list(map(int,d[2+i*m:2+(i+1)*m])) for i in range(n)];nr=1;nc=1
    while nr<n:nr*=2
    while nc<m:nc*=2
    tree=[[0]*(2*nc) for _ in range(2*nr)]
    for i,row in enumerate(grid):
        for j,v in enumerate(row):tree[nr+i][nc+j]=v
        for j in range(nc-1,0,-1):tree[nr+i][j]=max(tree[nr+i][j*2],tree[nr+i][j*2+1])
    for i in range(nr-1,0,-1):
        for j in range(1,2*nc):tree[i][j]=max(tree[2*i][j],tree[2*i+1][j])
    def query(top,bottom,left,right):
        if top>bottom or left>right:return 0
        top+=nr;bottom+=nr+1;result=0
        while top<bottom:
            nodes=[]
            if top&1:nodes.append(top);top+=1
            if bottom&1:bottom-=1;nodes.append(bottom)
            for node in nodes:
                a,b=left+nc,right+nc+1
                while a<b:
                    if a&1:result=max(result,tree[node][a]);a+=1
                    if b&1:b-=1;result=max(result,tree[node][b])
                    a//=2;b//=2
            top//=2;bottom//=2
        return result
    found=[]
    for i in range(n):
        for j in range(m):
            v=grid[i][j]
            if v==0:continue
            biggest=query(max(0,i-v+1),min(n-1,i+v-1),max(0,j-v),min(m-1,j+v))
            for row in (i-v,i+v):
                if 0<=row<n:biggest=max(biggest,query(row,row,max(0,j-v+1),min(m-1,j+v-1)))
            if biggest<v:found.append((i,j))
    return str(len(found))+'\n'+'\n'.join(f'{i} {j}' for i,j in found)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
