def solve(d):
    positions=[]
    for i,c in enumerate(d[0]):
        if c=='R':positions.append(i-len(positions))
    if not positions:return '0'
    middle=positions[len(positions)//2];answer=sum(abs(v-middle) for v in positions)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
