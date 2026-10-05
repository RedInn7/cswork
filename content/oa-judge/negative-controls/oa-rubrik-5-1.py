import sys
def solve(raw):
    word,k=raw.split(); k=int(k); out=[]; i=0
    while i<len(word):
        j=i+1
        while j<len(word) and word[j]==word[i]: j+=1
        if j-i<k: out.append(word[i:j])
        i=j
    return "".join(out)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
