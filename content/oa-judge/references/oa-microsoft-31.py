def solve(d):
    incoming=[];outgoing=[];out=[];i=1
    while i<len(d):
        op=d[i];i+=1
        if op=='push':incoming.append(d[i]);i+=1;out.append('null')
        elif op=='empty':out.append('true' if not incoming and not outgoing else 'false')
        else:
            if not outgoing:
                while incoming:outgoing.append(incoming.pop())
            out.append(outgoing.pop() if op=='pop' else outgoing[-1])
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
