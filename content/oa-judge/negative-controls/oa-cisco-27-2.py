def solve(raw):
    import re
    from array import array
    values=(int(m.group()) for m in re.finditer(r'-?\d+',raw));n=next(values);threshold=array('i',(next(values) for _ in range(n)));head=array('i',[-1])*n;to=array('I');weight=array('i');following=array('i')
    def edge(u,v,w):
        to.append(v);weight.append(w);following.append(head[u]);head[u]=len(to)-1
    for _ in range(n-1):
        u=next(values)-1;v=next(values)-1;w=next(values);edge(u,v,w);edge(v,u,w)
    answer=0;stack=[(0,-1,0,0,False)]
    while stack:
        u,parent,distance,minimum,removed=stack.pop()
        removed=removed or (u!=0 and distance-minimum>max(0,threshold[u]))
        answer+=removed;minimum=min(minimum,distance);e=head[u]
        while e!=-1:
            v=to[e]
            if v!=parent:stack.append((v,u,distance+weight[e],minimum,removed))
            e=following[e]
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
