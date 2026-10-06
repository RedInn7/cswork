def ds(x):
 s=0
 while x:s+=x%10;x//=10
 return s
def solve(raw):
 z=int(raw);target=ds(z);x=z+1
 while ds(x)!=target:x+=1
 return str(x)

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
