def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));diff=[0]*(n+1)
    for i in range(2+n,len(d),2):l,r=int(d[i]),int(d[i+1]);diff[l]+=1;diff[r+1]-=1
    active=0;items=[]
    for i,v in enumerate(a):active+=diff[i];items.append((v,active))
    items.sort();prefix=answer=0;i=0
    while i<n:
        j=i;weight=unused=0
        while j<n and items[j][0]==items[i][0]:weight+=items[j][1];unused+=items[j][1]==0;j+=1
        prefix+=weight;answer+=unused*prefix;i=j
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
