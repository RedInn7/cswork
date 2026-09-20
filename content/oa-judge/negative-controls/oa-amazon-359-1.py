def solve(raw):
    import json
    out=[]
    for new,old in json.loads(raw):
        j=0
        for c in new:
            if j<len(old) and (c==old[j] or chr(ord(c)+1)==old[j]):j+=1
        out.append('YES' if j==len(old) else 'NO')
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
