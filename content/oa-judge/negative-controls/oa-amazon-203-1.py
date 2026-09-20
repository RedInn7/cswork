def solve(d):
    n,k=map(int,d[:2]);words=d[2:];freq=[]
    for word in words:
        row=[0]*26
        for c in word:row[ord(c)-97]+=1
        freq.append(row)
    answer=-1
    for i in range(n):
        for j in range(i):
            diff=abs(len(words[i])-len(words[j]))
            if diff<=answer:continue
            common=0
            for a,b in zip(freq[i],freq[j]):
                common+=int(a>0 and b>0)
                if common>k:break
            if common<=k:answer=max(answer,diff)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
