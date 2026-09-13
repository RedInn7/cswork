def solve(d):
    first,message=d.split('\n',1);k=int(first)
    if len(message)<=k:return message
    chosen=[];length=0
    for word in message.split(' '):
        candidate=length+len(word)+(1 if chosen else 0)
        if candidate+3>k:break
        chosen.append(word);length=candidate
    return ' '.join(chosen)+' ...' if chosen else '...'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
