def solve(d):
    width,p=map(int,d[:2]);index=2;lines=['*'*(width+4)]
    for _ in range(p):
        count=int(d[index]);index+=1
        for word in d[index:index+count]:
            padding=width-len(word);lines.append('* '+' '*(padding//2)+word+' '*(padding-padding//2)+' *')
        index+=count
    return '\n'.join(lines+[lines[0]])
if __name__=='__main__':
    import sys
    print(solve(sys.stdin.read().split()))
