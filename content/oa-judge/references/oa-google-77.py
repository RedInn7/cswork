def solve(data):
    n,k,m=map(int,data[:3]);v=list(map(int,data[3:]));board=[0]*(n*n);occupied=0;winner=False;answer=[]
    for i in range(0,len(v),3):
        player,r,c=v[i:i+3];cell=r*n+c
        if winner:answer.append('Game Over');continue
        if board[cell]:answer.append('Invalid Move');continue
        board[cell]=player;occupied+=1
        for dr,dc in ((1,0),(0,1),(1,1),(1,-1)):
            count=1
            for direction in (-1,1):
                for step in (1,2):
                    a,b=r+direction*step*dr,c+direction*step*dc
                    if not(0<=a<n and 0<=b<n) or board[a*n+b]!=player:break
                    count+=1
            if count>=3:winner=True
        answer.append(f'Player {player} won' if winner else ('Draw' if occupied==n*n else 'In Progress'))
    return '\n'.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
