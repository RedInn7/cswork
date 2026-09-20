def solve(raw):
    a=list(map(int,raw.split()[1:]));out=[]
    values=[(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]
    for v in a:
        result=''
        for value,symbol in values:
            q,v=divmod(v,value);result+=symbol*q
        out.append(result)
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
