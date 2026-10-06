def solve(raw):
 s=raw.strip();p=set();i=0
 while i<len(s):
  if s[i]!="G" or i-1 in p:i+=1;continue
  if i>0 and s[i-1]=="-":p.add(i-1);i+=1
  elif i+1<len(s) and s[i+1]=="-":p.add(i+1);i+=2
  else:return "-1"
 return str(len(p))
