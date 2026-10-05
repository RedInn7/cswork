import sys
def solve(raw):
 s=raw.strip(); ones=0; ans=0; i=0
 while i<len(s):
  if s[i]=='1': ones+=1;i+=1;continue
  j=i
  while j<len(s) and s[j]=='0':j+=1
  if ones: ans+=ones*((j-i)+1)
  i=j
 return str(ans)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
