def solve(d):
    length,count=map(int,d[:2]);source=d[2];zeros=source.count('0');prefix=[];ones=0
    for c in source:ones+=c=='1';prefix.append(ones)
    answers=[]
    for query in d[3:]:
        need=zeros-query.count('0');available=query.count('?')
        if not 0<=need<=available:answers.append('NO');continue
        total=0;valid=True
        for i,c in enumerate(query):
            if c=='?':
                c='0' if need else '1'
                if c=='0':need-=1
            total+=c=='1'
            if total>prefix[i]:valid=False;break
        answers.append('YES' if valid else 'NO')
    return ' '.join(answers)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
