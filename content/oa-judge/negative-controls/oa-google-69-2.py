def solve(data):
    n,k=map(int,data[:2]);products=[(data[2+2*i],int(data[3+2*i])) for i in range(n)];word=data[-1];answer=[[] for _ in word]
    for name,score in sorted(products,key=lambda p:(p[1],p[0]),reverse=True):
        for i in range(min(len(name),len(word))):
            if name[i]!=word[i]:break
            if len(answer[i])<k:answer[i].append(name)
    return '\n'.join(str(len(row))+(' '+' '.join(row) if row else '') for row in answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
