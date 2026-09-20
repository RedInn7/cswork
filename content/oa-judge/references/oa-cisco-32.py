def solve(raw):
    import re
    from array import array
    values=(int(m.group()) for m in re.finditer(r'-?\d+',raw));n=next(values);m=next(values);a=array('i',values)
    return '\n'.join(' '.join(str(a[r*n+c]) for r in range(n-1,-1,-1)) for c in range(n))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
