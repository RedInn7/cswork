def solve(raw):
    s=raw.strip();found=set()
    for left in range(len(s)):
        for right in range(left+1,len(s)+1):
            part=s[left:right]
            if part==part[::-1]:found.add(part)
    return str(len(found))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
