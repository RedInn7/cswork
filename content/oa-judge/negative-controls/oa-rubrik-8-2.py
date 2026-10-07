import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    tests = next(tokens)
    output = []
    for _ in range(tests):
        n, m = next(tokens), next(tokens)
        previous = [0] * (m + 2)
        for row in range(n):
            current = [0] * (m + 2)
            states = []
            for column in range(1, m + 1):
                value = next(tokens)
                ancestor = max(previous[column-1], previous[column], previous[column+1])
                states.append('1')
                current[column] = max(value, ancestor)
            previous = current
            output.append(' '.join(states))
    return '\n'.join(output) + '\n'

if __name__ == '__main__':
    sys.stdout.write(solve(sys.stdin.buffer.read()))
