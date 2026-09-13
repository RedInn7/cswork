def solve(d):
    s=d[0];last=[-1]*26;first=[len(s)]*26
    for i,c in enumerate(s):
        if c.islower():last[ord(c)-97]=i
        else:first[ord(c)-65]=min(first[ord(c)-65],i)
    return str(sum(last[i]>=0 and first[i]<len(s) and last[i]<first[i] for i in range(1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
