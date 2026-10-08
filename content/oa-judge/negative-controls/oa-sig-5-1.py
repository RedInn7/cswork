import sys

def solve(raw):
    values=list(map(int,raw.split()))
    n,q=values[:2]
    cells=[-1 if v else 0 for v in values[2:2+n]]
    counter=0
    answer=[]
    for offset in range(2+n,len(values),2):
        kind,x=values[offset:offset+2]
        if kind==0:
            start=-1
            for i in range(0,n-x+1,8):
                if all(v==0 for v in cells[i:i+x]):
                    start=i
                    break
            if start==-1:
                counter+=1
                answer.append(-1)
            else:
                counter+=1
                cells[start:start+x]=[counter]*x
                answer.append(start)
        else:
            removed=0
            for i in range(n):
                if cells[i]==x:
                    cells[i]=0
                    removed+=1
            answer.append(removed if removed else -1)
    return ' '.join(map(str,answer))

if __name__=='__main__':
    print(solve(sys.stdin.read()))
