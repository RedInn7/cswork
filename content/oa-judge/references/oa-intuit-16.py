import sys
s=sys.stdin.buffer.readline().decode().strip();best=-1;start=0
for i,ch in enumerate(s+"0"):
    if ch.isdigit():
        if any(c.isupper() for c in s[start:i]):best=max(best,i-start)
        start=i+1
print(best)
