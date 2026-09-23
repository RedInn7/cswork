def solve(data):
    it=iter(map(str,data.split())); n=int(next(it)); q=int(next(it)); bits=next(it)
    zero=[0]*(n+1)
    for i,ch in enumerate(bits): zero[i+1]=zero[i]+(ch=='0')
    flipped=False; answer=[]
    for _ in range(q):
        op=next(it)
        if op=='flip': flipped=not flipped
        else:
            i=int(next(it)); z=zero[i+1]
            answer.append(str(i+1-z if flipped else z))
    return ' '.join(answer)

if __name__=='__main__':
 import sys
 print(solve(sys.stdin.read()))
