import sys
def solve(s):
 s=s.strip(); odd=sorted((c for c in s if int(c)%2),reverse=True); even=sorted(c for c in s if not int(c)%2); i=j=0; out=[]
 for c in s:
  if int(c)%2: out.append(odd[i]); i+=1
  else: out.append(even[j]); j+=1
 return "".join(out)
if __name__=="__main__": print(solve(sys.stdin.read()))
