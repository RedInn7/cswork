import sys
def solve(raw):
 t=list(map(int,raw.split()));R,C,a,b,x,y=t[:6];p=6;cr=t[p:p+R-1];return str(sum(cr[min(a,x):max(a,x)]))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
