def solve(raw):
    n=int(raw);blocks=[];part=[]
    for i in range(1,n+1):
        if i%15==0:value='FizzBuzz'
        elif i%3==0:value='Fizz'
        elif i%5==0:value='Buzz'
        else:value=str(i)
        part.append(value)
        if len(part)==8192:blocks.append('\n'.join(part));part=[]
    if part:blocks.append('\n'.join(part))
    return '\n'.join(blocks)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
