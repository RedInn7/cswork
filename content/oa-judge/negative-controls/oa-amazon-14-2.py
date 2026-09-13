def solve(d):
    s,t=d; j=0
    for c in s:
        if c==t[j] or chr((ord(c)-96)%26+97)==t[j]: j+=1
        if j>0: return 'YES'
    return 'NO'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
