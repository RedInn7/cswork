def solve(raw):
    a=list(map(int,raw.split()))[1:]
    if not a:return ''
    start=end=a[0];out=[]
    for value in a[1:]:
        if value<=end+2:end=value
        else:
            out.append(str(start) if start==end else f'{start} to {end}');start=end=value
    out.append(str(start) if start==end else f'{start} to {end}')
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
