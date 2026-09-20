def solve(raw):
    a=list(map(int,raw.split()))[1:];answer=0
    for values in (a,reversed(a)):
        stack=[]
        for i,v in enumerate(values):
            while stack and stack[-1][1]<=v:stack.pop()
            answer+=i-(stack[-1][0] if stack else -1);stack.append((i,v))
    groups=[];both=0
    for v in a:
        while groups and groups[-1][0]<v:groups.pop()
        if groups and groups[-1][0]==v:groups[-1][1]+=1;both+=groups[-1][1]
        else:groups.append([v,1]);both+=1
    return str(answer-both)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
