def solve(data):
    layout,word=data;position={c:i for i,c in enumerate(layout)};current=0;answer=0
    for c in word:
        answer+=abs(position[c]-current);current=0
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
