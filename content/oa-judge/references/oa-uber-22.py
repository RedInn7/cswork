def solve(d):
    health=int(d[1])
    for i in range(2,len(d)):health=max(0,min(100,health+int(d[i])))
    return str(health)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
