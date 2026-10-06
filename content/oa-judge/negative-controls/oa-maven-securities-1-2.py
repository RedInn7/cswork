def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; arr=a[1:1+n]; total=sum(arr); p=0; z=0
 for x in arr[:-1]:
  p+=abs(x); z+=p>total-p
 return str(z)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
