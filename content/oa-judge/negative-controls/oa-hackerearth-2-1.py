def solve(raw):
    v=raw.split();n=int(v[0]);s=v[1];girls=[];out=[]
    for i,ch in enumerate(s[:n],1):
        if ch=='0':girls.append(i)
        else:out.append(str(girls.pop(0) if girls else -1))
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
