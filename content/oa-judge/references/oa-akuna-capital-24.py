import sys
def solve(raw):
 t=list(map(int,raw.split()));rows,cols,ir,ic,fr,fc=t[:6];p=6;cr=t[p:p+rows-1];p+=rows-1;cc=t[p:p+cols-1]
 return str(sum(cr[min(ir,fr):max(ir,fr)])+sum(cc[min(ic,fc):max(ic,fc)]))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
