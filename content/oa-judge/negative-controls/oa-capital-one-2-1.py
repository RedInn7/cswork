import sys
def solve(raw):
 p,m,d=raw.split();m=int(m);d=int(d);names=['NewMoon','Crescent','Quarter','Gibbous','Full','Waning','Eclipse','Twilight']
 return names[(names.index(p)+30*(m-1)+d-1)%8]
if __name__=='__main__': print(solve(sys.stdin.read()))
