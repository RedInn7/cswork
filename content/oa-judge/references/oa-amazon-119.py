def solve(d):
    s=d[0];positions={}
    for i,c in enumerate(s):positions.setdefault(c,[]).append(i)
    answer=0
    for c in positions:
        balance=0;seen={0:1}
        for v in s:
            balance+=1 if v==c else -1;answer+=seen.get(balance,0);seen[balance]=seen.get(balance,0)+1
    keys=list(positions)
    for a in range(len(keys)):
        for b in range(a):
            x,y=positions[keys[a]],positions[keys[b]];i=j=0;previous=-2;balance=0;seen={0:1}
            while i<len(x) or j<len(y):
                if j==len(y) or i<len(x) and x[i]<y[j]:p=x[i];i+=1;step=1
                else:p=y[j];j+=1;step=-1
                if p!=previous+1:balance=0;seen={0:1}
                balance+=step;answer-=seen.get(balance,0);seen[balance]=seen.get(balance,0)+1;previous=p
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
