def compare(s1, s2):
    def process(value):
        stack = []
        for char in value:
            if char == "#":
                if stack:
                    stack.pop()
            else:
                stack.append(char)
        return stack
    return 1 if process(s1) == process(s2) else 0

def solve(raw):
    lines = raw.decode("ascii").splitlines()
    if len(lines) != 2:
        raise ValueError("expected exactly two input lines")
    return str(compare(lines[0], lines[1]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.buffer.read()))
