def solve(d):
    k=int(d[1]);out=[]
    for c in d[2][::-1]:
        if c=='0' and k:out.append('1');k-=1
        else:out.append('0')
    return ''.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
