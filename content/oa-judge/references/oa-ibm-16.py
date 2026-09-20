def solve(d):
    lines=d.split('\n');n=int(lines[0]);freq={};answer=0
    for s in lines[1:n+1]:
        mask=0
        for c in s:mask|=1<<(ord(c)-97)
        answer+=freq.get(mask,0);freq[mask]=freq.get(mask,0)+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
