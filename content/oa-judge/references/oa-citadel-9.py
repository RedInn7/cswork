def solve(raw):
    d=raw.split();n,k,f,b=map(int,d[:4]);s=d[4];ones=s.count('1');add=min(k,n-ones)
    if not ones:return str(add*f+max(0,add-1)*b)
    pairs=sum(s[i-1:i+1]=='11' for i in range(1,n));gaps=[];i=0
    while i<n:
        if s[i]=='1':i+=1;continue
        j=i
        while j<n and s[j]=='0':j+=1
        if i>0 and j<n:gaps.append(j-i)
        i=j
    remain=add;extra=0
    for gap in sorted(gaps):
        if gap>remain:break
        remain-=gap;extra+=1
    return str((ones+add)*f+(pairs+add+extra)*b)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
