import sys
def solve(raw):
 z=list(map(int,raw.split())); finish,n=z[:2]; scooters=sorted(z[2:2+n]); pos=total=0; i=0
 while pos<finish:
  while i<n and scooters[i]<pos: i+=1
  if i==n: break
  x=scooters[i]; i+=1; reached=min(finish,x+10); total+=reached-x; pos=reached
 return str(total)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
