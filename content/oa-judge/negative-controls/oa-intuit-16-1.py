import sys
s=sys.stdin.readline().strip();best=0;run=0
for c in s+"0":
    if c.isdigit():best=max(best,run);run=0
    else:run+=1
print(best if best else -1)
