def solve(raw):
    import json
    lines=raw.split('\n');a=json.loads(lines[0]);b=json.loads(lines[1])
    if len(a)<len(b):a,b=b,a
    row=[0]*(len(b)+1)
    for x in a:
        diagonal=0
        for j,y in enumerate(b,1):
            old=row[j]
            if x==y:row[j]=diagonal+1
            else:row[j]=max(row[j],row[j-1])
            diagonal=old
    return str(max(len(a),len(b))-row[-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
