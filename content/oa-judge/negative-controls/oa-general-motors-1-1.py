def solve(raw):
 v=raw.splitlines();k=int(v[0]);msg=v[1]
 if len(msg)<=k:return msg
 out=[]
 for w in msg.split():
  t=' '.join(out+[w])+' ...'
  if len(t)-1>k:break
  out.append(w)
 return ' '.join(out)+' ...' if out else '...'

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
