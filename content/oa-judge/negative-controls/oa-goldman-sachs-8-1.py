def solve(raw):
    data=raw.split();n=int(data[0]);answers=[]
    for command in data[1:1+n]:answers.append('YES' if command.count('G')==0 else 'NO')
    return '\n'.join(answers)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
