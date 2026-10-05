import sys
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];a=t[1:1+n];p=0;o=[]
 for i,v in enumerate(a):o.append(str(p-i*v));p+=v
 return ' '.join(o)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
