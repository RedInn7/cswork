def solve(d):
    width,p=map(int,d[:2]);index=2;result=['*'*(width+4)]
    for _ in range(p):
        count=int(d[index]);words=d[index+1:index+1+count];index+=count+1;start=0
        while start<count:
            end=start;letters=0
            while end<count and letters+len(words[end])+end-start<=width:letters+=len(words[end]);end+=1
            row=words[start:end]
            if end==count or len(row)==1:
                content=' '.join(row);padding=width-len(content);left=padding//2;content=' '*left+content+' '*(padding-left)
            else:
                gaps=len(row)-1;base,extra=divmod(width-letters,gaps);content=''.join(word+(' '*(base+(i>=gaps-extra)) if i<gaps else '') for i,word in enumerate(row))
            result.append('* '+content+' *');start=end
    result.append(result[0]);return '\n'.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
