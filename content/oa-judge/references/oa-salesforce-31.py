def solve(raw):
    import io
    stream=io.StringIO(raw);n=int(stream.readline());result=[]
    for _ in range(n):
        word=stream.readline().rstrip('\r\n');last=None;run=answer=0
        for ch in word:
            if ch==last:run+=1
            else:answer+=run//2;run=1;last=ch
        answer+=run//2;result.append(answer)
    return ' '.join(map(str,result))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
