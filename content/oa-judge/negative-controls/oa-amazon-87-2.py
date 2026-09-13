def solve(d):
    n,m,q,w=map(int,d[:4]);logs=sorted((int(d[5+2*i]),int(d[4+2*i])) for i in range(m));queries=sorted((int(v),i) for i,v in enumerate(d[4+2*m:]));counts=[0]*(n+1);left=right=active=0;answer=[0]*q
    for t,index in queries:
        while right<m and logs[right][0]<=t:
            skill=logs[right][1];active+=counts[skill]==0;counts[skill]+=1;right+=1
        while left<right and logs[left][0]<t-w:
            skill=logs[left][1];counts[skill]-=1;active-=counts[skill]==0;left+=1
        answer[len(answer)-1-index]=n-active
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
