from collections import Counter
def solve(d):
    lines=d.split('\n');n=int(lines[0]);logs=[line.strip() for line in lines[1:1+n]];counts=Counter(logs)
    return next((line for line in logs if counts[line]==1),'')

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
