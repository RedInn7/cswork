def solve(d):
    lines=d.splitlines();width,p=map(int,lines[0].split());index=1;result=['*'*(width+2)]
    for _ in range(p):
        align,count=lines[index].split();count=int(count);index+=1;current=''
        def render(text):return '*'+(text.ljust(width) if align=='LEFT' else text.rjust(width))+'*'
        for word in lines[index:index+count]:
            candidate=word if not current else current+' '+word
            if len(candidate)>width:result.append(render(current));current=word
            else:current=candidate
        result.append(render(current));index+=count
    result.append('*'*(width+2));return '\n'.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
