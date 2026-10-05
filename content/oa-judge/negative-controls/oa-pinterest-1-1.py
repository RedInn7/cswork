import sys
def solve(raw):
 s=raw.strip(); best=''; n=0; i=0
 while i<len(s):
  j=i+1
  while j<len(s) and s[j]==s[i]: j+=1
  if j-i>n: best=s[i]+str(j-i); n=j-i
  i=j
 return best
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
