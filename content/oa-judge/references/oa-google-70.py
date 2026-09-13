def solve(data):
    s=data[0];n=len(s);parity=[0]*26;ones=[0]*26
    for c in s:
        parity[ord(c)-97]^=1
        for j in range(26):ones[j]+=parity[j]
    odd=sum(v*(n+1-v) for v in ones);odd_lengths=((n+2)//2)*((n+1)//2)
    return str((odd-odd_lengths)//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
