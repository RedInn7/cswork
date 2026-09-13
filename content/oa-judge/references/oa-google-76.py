def solve(data):
    n,width=map(int,data[:2]);words=data[2:];answer=[];i=0
    while i<n:
        end=i;letters=0
        while end<n and letters+len(words[end])+(end-i)<=width:letters+=len(words[end]);end+=1
        count=end-i
        if end==n or count==1:line=' '.join(words[i:end]).ljust(width)
        else:
            base,extra=divmod(width-letters,count-1)
            line=''.join(words[j]+' '*(base+(j-i<extra)) for j in range(i,end-1))+words[end-1]
        answer.append(line);i=end
    return str(len(answer))+'\n'+'\n'.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
