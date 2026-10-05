import sys
def solve(raw):
    lines=raw.splitlines(); n=int(lines[0]); out=[]
    for word in lines[1:1+n]:
        edits=0; i=0
        while i<len(word):
            j=i+1
            while j<len(word) and word[j]==word[i]: j+=1
            edits+=(j-i)//2; i=j
        out.append(str(edits))
    return " ".join(out)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
