import sys
def solve(raw):
 s=raw.strip(); score=0
 for i,c in enumerate(s):
  if c=='5': score+=2
  if int(c)%2: score+=1
  if i and s[i-1:i+1]=='33': score+=4
 if int(s[-1])==0 or int(s[-1])==5: score+=6
 i=0
 while i<len(s):
  j=i+1
  while j<len(s) and ord(s[j])==ord(s[j-1])+1: j+=1
  score+=(j-i)*(j-i); i=j
 return str(score)
if __name__=='__main__': print(solve(sys.stdin.read()))
