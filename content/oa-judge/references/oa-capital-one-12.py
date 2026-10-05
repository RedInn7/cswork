import sys
def solve(raw):
 lines=raw.splitlines(); n,r=map(int,lines[0].split()); words=lines[1:1+n]; recipes=lines[1+n:1+n+r]; ss=set(words); mx=max(map(len,words)); ans=[]
 for w in recipes:
  dp=[False]*(len(w)+1); dp[0]=True
  for i in range(1,len(w)+1):
   for j in range(max(0,i-mx),i):
    if dp[j] and w[j:i] in ss: dp[i]=True; break
  ans.append('YES' if dp[-1] else 'NO')
 return ' '.join(ans)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
