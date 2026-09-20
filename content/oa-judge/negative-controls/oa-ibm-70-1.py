def solve(raw):
    import json
    lines=json.loads(raw);chapter=section=0;out=[]
    for line in lines:
        if line.startswith('# '):
            chapter+=1;out.append(f'{chapter}. '+line[2:])
        elif line.startswith('## '):
            section+=1;out.append(f'{chapter}.{section}. '+line[3:])
    return json.dumps(out,ensure_ascii=False)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
