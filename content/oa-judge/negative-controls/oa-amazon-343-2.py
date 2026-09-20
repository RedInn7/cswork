def solve(raw):
    target,content=raw.split();m=len(target);answer=0
    for start in range(len(content)-m+1):
        word=content[start:start+m];bad=[i for i in range(m) if word[i]!=target[i]]
        if not bad:answer+=0
        elif len(bad)==2:
            i,j=bad
            if j==i+1 and word[i]==target[j] and word[j]==target[i]:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
