def solve(raw):
    import json
    rows,words=json.loads(raw);columns=[''.join(row[j] for row in rows) for j in range(len(rows[0]))];lines=rows+columns;lines=lines;cache={}
    def contains(line,word,pi):
        matched=0
        for ch in line:
            while matched and ch!=word[matched]:matched=pi[matched-1]
            if ch==word[matched]:matched+=1
            if matched==len(word):return True
        return False
    output=[]
    for word in words:
        if word not in cache:
            pi=[0]*len(word)
            for i in range(1,len(word)):
                k=pi[i-1]
                while k and word[i]!=word[k]:k=pi[k-1]
                if word[i]==word[k]:k+=1
                pi[i]=k
            cache[word]=any(contains(line,word,pi) for line in lines)
        output.append('Yes' if cache[word] else 'No')
    return ' '.join(output)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
