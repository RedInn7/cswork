def solve(raw):
    s=raw.strip();out=[];i=0
    while i<len(s):
        j=i;counts=[0]*10
        while j<len(s) and int(s[j])%2==int(s[i])%2:counts[int(s[j])]+=1;j+=1
        for d in range(9,-1,-1):out.append(str(d)*counts[d])
        i=j
    return ''.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
