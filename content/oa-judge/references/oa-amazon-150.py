def solve(d):
    n,m,q,w=map(int,d[:4]);logs=sorted((int(d[i+1]),int(d[i])-1) for i in range(4,4+2*m,2));queries=list(map(int,d[4+2*m:]));frequency=[0]*n;active=left=right=0;answer=[0]*q
    for index in sorted(range(q),key=lambda i:queries[i]):
        time=queries[index]
        while right<m and logs[right][0]<=time:
            skill=logs[right][1];active+=frequency[skill]==0;frequency[skill]+=1;right+=1
        while left<right and logs[left][0]<time-w:
            skill=logs[left][1];frequency[skill]-=1;active-=frequency[skill]==0;left+=1
        answer[index]=n-active
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
