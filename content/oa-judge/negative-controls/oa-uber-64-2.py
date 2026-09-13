def solve(d):
    total=count=0
    for c in d[0]:total+=ord(c)-48;count+=c=='7'
    return str(int(total%3==0 and count==2))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
