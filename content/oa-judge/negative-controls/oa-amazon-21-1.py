def solve(d):
    s,t=d[:2]; p=int(d[2]); m=len(t); target=[0]*26; answer=0
    for c in t: target[ord(c)-97]+=1
    for r in range(min(p,len(s))):
        chain=s[r::p]; count=[0]*26
        for i,c in enumerate(chain):
            count[ord(c)-97]+=1
            if i>=m: count[ord(chain[i-m])-97]-=1
            if i>=m and count==target: answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
