def solve(raw):
    a,b,g=map(int,raw.split()); c=a+b; i=0
    while c or g:
        if c//10!=g//10: return str(i)
        c//=10; g//=10; i+=1
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
