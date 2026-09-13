def solve(data):
    table = 0; answer = 0
    for event in data[0]:
        if event == 'i': table += 1
        elif event == 'd': table = max(0, table-1)
        else:
            answer += table
            table = 0
    return answer

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
