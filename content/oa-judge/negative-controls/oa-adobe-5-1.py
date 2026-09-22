def solve(raw):
    import json
    from collections import defaultdict,deque
    begin,end,words=json.loads(raw)
    if begin==end:return '0'
    if end not in words or len(begin)!=len(end):return '-1'
    words=set(w for w in words if len(w)==len(begin));words.add(begin);groups=defaultdict(list)
    for word in words:
        for i in range(len(word)):groups[(i,word[:i]+word[i+1:])].append(word)
    q=deque([(begin,0)]);seen={begin}
    while q:
        word,d=q.popleft()
        for i in range(len(word)):
            for other in groups.pop((i,word[:i]+word[i+1:]),[]):
                if other==end:return str(d+2)
                if other not in seen:seen.add(other);q.append((other,d+1))
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
