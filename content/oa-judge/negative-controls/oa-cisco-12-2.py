def solve(raw):
    a=list(map(int,raw.split()))[1:]
    if not a:return ''
    start=end=a[0];out=[]
    for value in a[1:]:
        if value==end+1:end=value
        else:
            out.append(str(start));start=end=value
    out.append(str(start))
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
