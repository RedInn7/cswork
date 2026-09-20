def solve(d):
    from collections import Counter
    s=d[0];p=int(d[1]);words=d[2:];width=len(words[0]);target=Counter(words);answer=0
    for offset in range(width):
        left=offset;count=0;freq=Counter()
        for right in range(offset,len(s)-width+1,width):
            word=s[right:right+width]
            if word not in target:freq.clear();count=0;left=right+width;continue
            freq[word]+=1;count+=1
            while freq[word]>target[word]:
                old=s[left:left+width];freq[old]-=1;count-=1;left+=width
            if count==p:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
