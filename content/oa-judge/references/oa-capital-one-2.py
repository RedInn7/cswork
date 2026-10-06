import sys
def solve(raw):
 phase,month,day=raw.split();month=int(month);day=int(day)
 names=['NewMoon','Crescent','Quarter','Gibbous','Full','Waning','Eclipse','Twilight']
 days=[31,28,31,30,31,30,31,31,30,31,30,31]
 offset=sum(days[:month-1])+day-1
 return names[(names.index(phase)+offset)%8]
if __name__ == '__main__': print(solve(sys.stdin.read()))
