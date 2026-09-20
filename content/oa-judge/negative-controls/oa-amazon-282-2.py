def solve(d):
    values=list(map(int,d[1:]));intervals=sorted(zip(values[::2],values[1::2]));out=[]
    for a,b in intervals:
        if out and a<=out[-1][1]+1:out[-1][1]=max(out[-1][1],b)
        else:out.append([a,b])
    return str(len(out))+'\n'+'\n'.join(str(a)+' '+str(b) for a,b in out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
