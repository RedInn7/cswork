def solve(data):
    s,p=data.split(); m=len(p); n=len(s)
    if m>n: return '-1'
    want=[0]*26; have=[0]*26
    for c in p: want[ord(c)-97]+=1
    for c in s[:m]: have[ord(c)-97]+=1
    for i in range(n-m):
        if have==want: return str(i)
        if i+m<n:
            have[ord(s[i])-97]-=1; have[ord(s[i+m])-97]+=1
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
