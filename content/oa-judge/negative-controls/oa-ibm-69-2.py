def solve(raw):
    d=list(map(int,raw.split()));a=sorted(d[1:],reverse=True);total=sum(a);taken=0
    for count,v in enumerate(a,1):
        taken+=v
        if taken>total-taken:break
    result=a[:count]
    return str(len(result))+'\n'+'\n'.join(map(str,result))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
