import sys,math
sx,sy,tx,ty=map(int,sys.stdin.buffer.read().split()); print("Yes" if tx>=sx and ty>=sy and math.gcd(sx,sy)==math.gcd(tx,ty) else "No")
