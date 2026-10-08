import sys

def solve(raw):
    tokens=raw.split()
    word=tokens[0]
    count=int(tokens[1])
    answer=[]
    for skeleton in tokens[2:2+count]:
        letters=set(skeleton)-{'-'}
        if all((a==b if a!='-' else b in letters) for a,b in zip(skeleton,word)):
            answer.append(skeleton)
    return str(len(answer))+'\n'+'\n'.join(answer)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
