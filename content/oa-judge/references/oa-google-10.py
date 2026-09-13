def solve(data):
    n,k=map(int,data[:2]); remove=n-k; stack=[]
    for digit in data[2:]:
        while remove and stack and stack[-1]<digit:stack.pop(); remove-=1
        stack.append(digit)
    return ''.join(stack[:k]).lstrip('0') or '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
