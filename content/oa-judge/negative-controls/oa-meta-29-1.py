def solve(data):
    left,right=map(int,data); count=0
    for value in range(left,right):
        a=value//100; b=value//10%10; c=value%10
        if a!=b and a!=c and b!=c:count+=1
    return str(count)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
