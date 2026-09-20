def solve(d):
    a=list(map(int,d[1:]));stack=[];dp=[]
    for i,v in enumerate(a):
        while stack and a[stack[-1]]>=v:stack.pop()
        if stack:j=stack[-1];length=i-j;previous=dp[j]
        else:length=min(i+1,v);previous=0
        dp.append(previous+length*(2*v-length+1)//2);stack.append(i)
    return str(max(dp))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
