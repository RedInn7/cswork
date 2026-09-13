def solve(data):
    text=data[0];children=[{}];terminal=[None]
    for j in range(2,len(data),2):
        word,identifier=data[j:j+2];node=0
        for char in word:
            if char not in children[node]:children[node][char]=len(children);children.append({});terminal.append(None)
            node=children[node][char]
        if terminal[node] is None:terminal[node]=identifier
    answer=[];i=0
    while i<len(text):
        node=0;j=i;end=i;found=None
        while j<len(text) and text[j] in children[node]:
            node=children[node][text[j]];j+=1
            if terminal[node] is not None:found=terminal[node];end=j
        if found is None:answer.append(text[i]);i+=1
        else:answer.append(found);i=end
    return ' '.join([str(len(answer))]+answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
