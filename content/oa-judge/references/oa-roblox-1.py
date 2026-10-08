import sys

def solve(raw):
    values=list(map(int,raw.split()))
    lengths={}
    best=0
    answer=[]
    for x in values[1:]:
        left=lengths.get(x-1,0)
        right=lengths.get(x+1,0)
        length=left+right+1
        lengths[x]=length
        lengths[x-left]=length
        lengths[x+right]=length
        best=max(best,length)
        answer.append(best)
    return ' '.join(map(str,answer))

if __name__=='__main__':
    print(solve(sys.stdin.read()))
