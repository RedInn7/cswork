import sys
def solve(raw):
    t=list(map(int,raw.split())); n,e,q=t[:3]; p=3; graph=[[] for _ in range(n+1)]
    for _ in range(e):
        u,v=t[p:p+2]; p+=2; graph[u].append(v); graph[v].append(u)
    answers=[]
    for x in dict.fromkeys(t[p:p+q]):
        seen={x}; stack=[x]
        while stack:
            u=stack.pop()
            for v in graph[u]:
                if v not in seen: seen.add(v); stack.append(v)
        answers.append(str(len(seen)))
    return " ".join(answers)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
