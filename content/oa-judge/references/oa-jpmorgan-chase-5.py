def solve(raw):
    import json
    holdings={};gain=0;out=[]
    for line in json.loads(raw):
        p=line.split();op=p[0]
        if op=='QUERY':out.append(gain);continue
        s=p[1];v=int(p[2])
        if op=='CHANGE':gain+=holdings.get(s,0)*v
        else:holdings[s]=holdings.get(s,0)+(v if op=='BUY' else -v)
    return str(len(out))+'\n'+'\n'.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
