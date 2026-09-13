from array import array
def solve(d):
    s=d[0];prefix=array('I',[0])*len(s);j=0
    for i in range(1,len(s)):
        while j and s[i]!=s[j]:j=prefix[j-1]
        if s[i]==s[j]:j+=1
        prefix[i]=j
    return str(min(prefix[-1],len(s)//2))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
