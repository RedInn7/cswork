def solve(d):
    key,text=d;variants={key}
    for i in range(len(key)-1):variants.add(key[:i]+key[i+1]+key[i]+key[i+2:])
    return str(sum(text[i:i+len(key)] ==key for i in range(len(text)-len(key)+1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
