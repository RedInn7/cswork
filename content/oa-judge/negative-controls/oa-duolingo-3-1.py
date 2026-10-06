def solve(raw):
    lines=raw.splitlines();message,n=lines[0],int(lines[1]);out=[];cons="bcdfghjklmnpqrstvwxyz"
    for i,c in enumerate(message):
        if (i+1)%n==0 and c.lower() in cons:
            x=cons[(cons.index(c.lower())+1)%len(cons)];out.append(x.upper() if c.isupper() else x)
        else:out.append(c)
    return "".join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
