def solve(d):
    pattern,s=d;mapping={};used=set()
    def visit(i,j):
        if i==len(pattern):return j==len(s)
        if len(s)-j<len(pattern)-i:return False
        c=pattern[i]
        if c in mapping:
            word=mapping[c];return False
        for end in range(j+1,len(s)-(len(pattern)-i-1)+1):
            word=s[j:end]
            if word in used:continue
            mapping[c]=word;used.add(word)
            if visit(i+1,end):return True
            used.remove(word);del mapping[c]
        return False
    return str(int(visit(0,0)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
