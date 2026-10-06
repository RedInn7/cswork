import sys
def solve(raw):
 s=raw.strip();ones=0;ans=0
 for c in s:
  if c=='1':ones+=1
  else:ans+=ones
 return str(ans)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
