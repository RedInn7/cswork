def solve(data):
    board=data[0]; answer=0
    for residue in range(3):
        started=False
        for cell in board[residue::3]:
            if cell=='T': started=True
            elif cell=='C' and started: answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
