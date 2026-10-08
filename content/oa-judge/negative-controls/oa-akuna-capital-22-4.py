import sys
s=sys.stdin.read().strip()
zeros=0
answer=0
for c in reversed(s):
    if c=='0': zeros+=1
    else: answer+=zeros+1
print(answer)
