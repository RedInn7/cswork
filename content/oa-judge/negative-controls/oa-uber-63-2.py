def solve(d):
    a=list(map(int,d[1:]));rounds=[str(len(a))+' '+' '.join(map(str,a))]
    while len(a)>1:
        a=[min(a[i:i+2]) for i in range(0,len(a),2)];rounds.append(str(len(a))+' '+' '.join(map(str,a)))
    return str(len(rounds))+'\n'+'\n'.join(rounds)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
