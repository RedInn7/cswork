from collections import Counter
def solve(d):
    s=d[0];q=int(d[1]);positions=[[] for _ in range(10)]
    for i,c in enumerate(s,1):positions[int(c)].append(i)
    out=[]
    for j in range(q):
        length=int(d[2+2*j]);query=d[3+2*j] if length else '';answer=0
        for c,count in Counter(query).items():
            p=positions[int(c)]
            if len(p)<count:answer=-1;break
            answer=max(answer,p[count-1])
        out.append(answer)
    return str(q)+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
