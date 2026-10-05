import sys
def solve(raw):
 lines=raw.splitlines(); q=int(lines[0]); users=set(); active=set(); cnt={}
 for line in lines[1:1+q]:
  p=line.split()
  if p[0]=='OFFLINE': active.discard(p[1]); continue
  sender=p[1]; users.add(sender); active.add(sender); m=int(p[3]); toks=p[4:4+m]
  mentioned=set(); direct=[]
  for tok in toks:
   if tok=='ALL': mentioned.update(users)
   elif tok=='HERE': mentioned.update(active)
   else: direct.append(tok)
  mentioned.update(direct)
  for u in mentioned: cnt[u]=cnt.get(u,0)+1
 return ' '.join(f'{u}={cnt[u]}' for u in sorted(cnt))
if __name__=='__main__': print(solve(sys.stdin.read()))
