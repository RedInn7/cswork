def solve(raw):
    d=list(map(int,raw.split()))[1:];a=sorted(zip(d[::2],d[1::2]));out=[]
    for l,h in a:
        if out and l<=out[-1][1]:out[-1][1]=h
        else:out.append([l,h])
    return str(len(out))+'\n'+'\n'.join(f'{l} {h}' for l,h in out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
