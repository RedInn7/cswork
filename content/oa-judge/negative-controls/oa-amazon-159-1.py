def solve(d):
    freq=[0]*26;totals=[0]*26
    for c in d[0]:
        freq[ord(c)-97]+=1;top=max(freq)
        for i in range(26):
            if freq[i]==top and freq.count(top)==1:totals[i]+=1
    return str(max(totals))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
