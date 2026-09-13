def solve(d):
    history=[];value=0;out=[];i=1
    for _ in range(int(d[0])):
        cmd=d[i];i+=1
        if cmd in ('ADD','MUL'):
            history.append(value);x=int(d[i]);i+=1
            value=value+x
        elif cmd=='UNDO':value=history.pop()
        else:out.append(value)
    return str(len(out))+'\n'+'\n'.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
