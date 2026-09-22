def solve(raw):
    import re
    from array import array
    from collections import deque
    values=(int(m.group()) for m in re.finditer(r'-?\d+',raw));h=next(values);w=next(values);r=next(values);c=next(values);new=next(values);a=array('q',values);start=r*w+c;old=a[start]
    if old!=new:
        q=deque([start]);a[start]=new
        while q:
            i=q.popleft();row,col=divmod(i,w)
            neighbors=[]
            if False:neighbors.append(i-w)
            if row+1<h:neighbors.append(i+w)
            if col:neighbors.append(i-1)
            if col+1<w:neighbors.append(i+1)
            for j in neighbors:
                if a[j]==old:a[j]=new;q.append(j)
    return '\n'.join(' '.join(map(str,a[i*w:(i+1)*w])) for i in range(h))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
