def solve(data):
    s=data[0]; count=len(s)*int(data[1]); head=0; step=1; left=True
    while count>1:
        if left or count%2:head+=step
        count//=2; step*=2; left=not left
    return s[head%len(s)]

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
