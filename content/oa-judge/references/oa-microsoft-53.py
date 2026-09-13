def solve(d):
    lines=d.split('\n');n=int(lines[0]);records={};ends=set()
    for i in range(n):
        start,end=lines[1+2*i].split();records[start]=(end,lines[2+2*i]);ends.add(end)
    current=next(key for key in records if key not in ends);result=[]
    for _ in range(n):end,payload=records[current];result.append(payload);current=end
    return ''.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
