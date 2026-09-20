def solve(raw):
    import json
    chapter=section=0;out=[]
    for line in json.loads(raw):
        if line.startswith('# '):chapter+=1;section=0;out.append(f'{chapter}. '+line[2:])
        elif line.startswith('## '):section+=1;out.append(f'{chapter}.{section}. '+line[3:])
    return json.dumps(out,ensure_ascii=False)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
