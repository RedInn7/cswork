import sys
def solve(raw):
    s=raw.strip(); runs=[]
    for c in s:
        if not runs or runs[-1][0]!=c: runs.append([c,1])
        else: runs[-1][1]+=1
    return str(sum(1 for a,b in zip(runs,runs[1:]) if a[1] and b[1]))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
