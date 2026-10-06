def solve(raw):
 t=raw.split();q=int(t[0]);out=[]
 for s in t[1:1+q]:
  e=[c for c in s if int(c)%2==0];o=[c for c in s if int(c)%2==1];i=j=0;ans=[]
  while i<len(e) and j<len(o):
   if e[i]<o[j]:ans.append(e[i]);i+=1
   else:ans.append(o[j]);j+=1
  ans.extend(e[i:]);ans.extend(o[j:]);out.append(''.join(ans))
 return '\n'.join(out)
