def solve(raw):
    lines=raw.split('\n');s=lines[0];kit=lines[2];ratings=list(map(int,lines[3].split()));balance=low=0
    for c in s:balance+=1 if c=='(' else -1;low=min(low,balance)
    left=-low;right=left+balance;a=sorted((v for c,v in zip(kit,ratings) if c=='('),reverse=True);b=sorted((v for c,v in zip(kit,ratings) if c==')'),reverse=True)
    answer=sum(a[:left])+sum(b[:right])
    while False:answer+=a[left]+b[right];left+=1;right+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
