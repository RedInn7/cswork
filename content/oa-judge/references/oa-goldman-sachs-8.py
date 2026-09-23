def solve(raw):
    data=raw.split();n=int(data[0]);commands=data[1:1+n];answers=[]
    dx=[0,1,0,-1];dy=[1,0,-1,0]
    for command in commands:
        x=y=direction=0
        for step in command:
            if step=='G':x+=dx[direction];y+=dy[direction]
            elif step=='L':direction=(direction+3)%4
            else:direction=(direction+1)%4
        answers.append('YES' if (x==0 and y==0) or direction!=0 else 'NO')
    return '\n'.join(answers)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
