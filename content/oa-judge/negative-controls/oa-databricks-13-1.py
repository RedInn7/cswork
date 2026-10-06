def solve(data):
    lines=data.split(); panel=lines[0]; q=int(lines[1]); out=[]
    for code in lines[2:2+q]:
        for cut in range(1,len(code)-1):
            start=int(code[:cut]); pat=code[cut:]
            out.append(pat if start+len(pat)<=len(panel) and panel[start:start+len(pat)]==pat else 'not found')
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
