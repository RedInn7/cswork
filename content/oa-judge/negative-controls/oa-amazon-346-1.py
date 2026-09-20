def solve(raw):
    s,k=raw.split();k=int(k);left=[0]*26;right=[0]*26;common=answer=0
    for c in s:right[ord(c)-97]+=1
    for c in s[:-1]:
        i=ord(c)-97;common-=int(left[i]>0 and right[i]>0);left[i]+=1;right[i]-=1;common+=int(left[i]>0 and right[i]>0)
        if common>=k:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
