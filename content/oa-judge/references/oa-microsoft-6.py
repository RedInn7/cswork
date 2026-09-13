def solve(d):
    s=d[0];counts={s[-1]:1};answer=0
    for i in range(len(s)-2,-1,-1):
        c=s[i]
        if c==s[i+1]:answer+=len(s)-i-1-counts.get(c,0);counts={c:len(s)-i-1}
        counts[c]=counts.get(c,0)+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
