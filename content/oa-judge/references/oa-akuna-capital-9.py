import sys
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];a=t[1:1+n];prefix=0;out=[]
 for i,v in enumerate(a):out.append(str(i*v-prefix));prefix+=v
 return ' '.join(out)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
