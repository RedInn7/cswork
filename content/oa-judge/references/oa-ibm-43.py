def solve(d):
    a=list(d[0]);i=0
    while i<len(a) and a[i]=='a':i+=1
    if i==len(a):a[-1]='z'
    else:
        while i<len(a) and a[i]!='a':a[i]=chr(ord(a[i])-1);i+=1
    return ''.join(a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
