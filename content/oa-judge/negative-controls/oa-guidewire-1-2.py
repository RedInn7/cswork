def solve(raw):
 s=raw.strip();p=set()
 for i,c in enumerate(s):
  if c=="G":
   if i+1<len(s) and s[i+1]=="-":p.add(i+1)
   elif i>0 and s[i-1]=="-":p.add(i-1)
   else:return "-1"
 return str(len(p))
