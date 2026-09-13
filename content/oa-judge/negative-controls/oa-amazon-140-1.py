def solve(d):
    answers=[]
    for i in range(1,len(d),2):
        a,b=d[i:i+2];forward={};back={};ok=True
        for x,y in zip(a,b):
            if x in forward and forward[x]!=y:ok=False;break
            forward[x]=y;back[y]=x
        answers.append('1' if ok else '0')
    return ' '.join(answers)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
