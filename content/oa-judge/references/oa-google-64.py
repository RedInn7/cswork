import sys
def solve(raw):
    data=raw.split(); n=int(data[0]); strings=data[1:]
    # Each trie node has separate groups for termination, child 0, and child 1.
    children=[[-1,-1] for _ in range(1)]
    terminal=[0]
    max_len=[0]
    for s in strings:
        node=0
        for ch in s:
            bit=ord(ch)-48
            nxt=children[node][bit]
            if nxt<0:
                nxt=len(children); children[node][bit]=nxt
                children.append([-1,-1]); terminal.append(0); max_len.append(0)
            node=nxt
        terminal[node]+=1
        max_len[node]=len(s)
    # Trie node indices are created before their descendants, so reverse order is postorder.
    for node in range(len(children)-1,-1,-1):
        for child in children[node]:
            if child>=0:
                max_len[node]=max(max_len[node],max_len[child])
    answer=0
    # A second pass evaluates distinct groups at each trie node.
    depth=[0]*len(children)
    stack=[0]
    while stack:
        node=stack.pop()
        groups=[]
        if terminal[node]: groups.append(depth[node])
        for child in children[node]:
            if child>=0:
                depth[child]=depth[node]+1; stack.append(child)
                groups.append(max_len[child])
        if len(groups)>=2:
            top=sorted(groups,reverse=True)[:2]
            answer=max(answer,top[0]+top[1]-2*depth[node])
    return str(answer)
print(solve(sys.stdin.read()))
