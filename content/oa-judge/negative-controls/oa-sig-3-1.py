import sys
from collections import Counter
def solve(raw):
    t=raw.split(); word=t[0]; answer=[]
    for s in t[2:2+int(t[1])]:
        supply=Counter(s.replace('-','')); demand=Counter(b for a,b in zip(s,word) if a=='-')
        if all(a=='-' or a==b for a,b in zip(s,word)) and all(demand[c]<=supply[c] for c in demand):
            answer.append(s)
    return str(len(answer))+'\n'+'\n'.join(answer)
if __name__=='__main__': print(solve(sys.stdin.read()))
