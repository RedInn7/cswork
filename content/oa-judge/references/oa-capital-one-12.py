import sys
def solve(raw):
 lines=raw.splitlines(); n,r=map(int,lines[0].split()); words=lines[1:1+n]; recipes=lines[1+n:1+n+r]; end='#'; trie={}
 for word in words:
  node=trie
  for ch in word: node=node.setdefault(ch,{})
  node[end]=True
 ans=[]
 for w in recipes:
  dp=[False]*(len(w)+1); dp[0]=True
  for i in range(len(w)):
   if not dp[i]: continue
   node=trie; j=i
   while j<len(w):
    node=node.get(w[j])
    if node is None: break
    j+=1
    if end in node: dp[j]=True
  ans.append('YES' if dp[-1] else 'NO')
 return ' '.join(ans)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
