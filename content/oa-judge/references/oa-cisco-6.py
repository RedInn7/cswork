def solve(raw):
    values=map(int,raw.split());n=next(values);odd=set()
    for value in values:
        if value in odd:odd.remove(value)
        else:odd.add(value)
    return str(len(odd))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
