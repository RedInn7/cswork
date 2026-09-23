def solve(raw):
    data=raw.split();n=int(data[0]);answers=[]
    for command in data[1:1+n]:
        direction=0
        for step in command:
            if step=='L':direction=(direction+3)%4
            elif step=='R':direction=(direction+1)%4
        answers.append('YES' if direction!=0 else 'NO')
    return '\n'.join(answers)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
