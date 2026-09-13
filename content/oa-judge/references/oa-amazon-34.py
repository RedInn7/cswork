def solve(d):
    s=d[0]; minimum=10; counts=[0]*10
    for c in reversed(s):
        value=int(c)
        if value>minimum: counts[min(value+1,9)]+=1
        else: counts[value]+=1; minimum=value
    return ''.join(str(i)*counts[i] for i in range(10))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
