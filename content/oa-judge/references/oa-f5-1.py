def solve(raw):
 z=raw.splitlines();n,now,w=map(int,z[0].split());c={}
 for line in z[1:1+n]:
  t,tw=line.split('\t',1);t=int(t)
  if now-w<=t<=now:
   i=0
   while i<len(tw):
    if tw[i]=='#':
     j=i+1
     while j<len(tw) and (tw[j].isascii() and (tw[j].isalnum() or tw[j]=='_')):j+=1
     if j>i+1:c[tw[i:j]]=c.get(tw[i:j],0)+1
     i=j
    else:i+=1
 return '\n'.join(sorted(c,key=lambda x:(-c[x],x))[:3])

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
