import sys
def solve(raw):
 z=list(map(int,raw.split())); n,k=z[:2]; h=[0]*k; a=[]
 for j,x in enumerate(z[2:2+n]): i=j%k; a.append(i); h[i]+=x
 return ' '.join(map(str,a))+chr(10)+' '.join(map(str,h))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
