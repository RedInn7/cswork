import sys,math
def solve(raw):
    a,b,c,d=map(int,raw.split());return 'Yes' if math.gcd(a,b)==math.gcd(c,d) else 'No'
if __name__=='__main__':print(solve(sys.stdin.read()))
