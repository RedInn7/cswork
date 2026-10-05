import sys
CS="bcdfghjklmnpqrstvwxyz"
def solve(s):
 n,word=s.split("\n",1);n=int(n);word=word.removesuffix("\n");cnt=0;o=[]
 for c in word:
  if c.isascii() and c.isalpha() and c.lower() not in "aeiou":
   cnt+=1
   if cnt%n==0:
    x=CS[(CS.index(c.lower())+1)%len(CS)];o.append(x.upper() if c.isupper() else x);continue
  o.append(c)
 return "".join(o)
if __name__=='__main__': print(solve(sys.stdin.read()))
