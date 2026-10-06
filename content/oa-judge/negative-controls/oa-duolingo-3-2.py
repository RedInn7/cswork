def solve(raw):
    lines=raw.splitlines();message,n=lines[0],int(lines[1]);out=[];count=0
    for c in message:
        if c.isascii() and c.isalpha() and c.lower() not in "aeiou":
            count+=1
            if count%n==0:
                out.append(chr(ord(c)+1));continue
        out.append(c)
    return "".join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
