def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; arr=a[1:1+n]; total=sum(arr); pref=0; ans=0
 for x in arr[:-1]:
  pref+=x
  if pref>total-pref: ans+=1
 return str(ans)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
