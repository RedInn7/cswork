import sys
def solve(raw):
 p,m,d=raw.split();m=int(m);d=int(d);names=['NewMoon','Crescent','Quarter','Gibbous','Full','Waning','Eclipse','Twilight'];days=[31,28,31,30,31,30,31,31,30,31,30,31]
 return names[(names.index(p)+sum(days[:int(m)-1])+int(d))%8]
if __name__=='__main__': print(solve(sys.stdin.read()))
