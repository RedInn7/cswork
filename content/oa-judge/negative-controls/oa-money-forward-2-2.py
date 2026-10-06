def solve(raw):
    transcript=raw.strip();board=['B','W']
    for turn,side in enumerate(transcript):
        color='B'
        if side=='L':
            board.insert(0,color)
            try:target=board.index(color,1)
            except ValueError:continue
            for i in range(1,target):board[i]=color
        else:
            board.append(color)
            try:target=len(board)-2-board[-2::-1].index(color)
            except ValueError:continue
            for i in range(target+1,len(board)-1):board[i]=color
    return f'{board.count("B")} {board.count("W")}'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
