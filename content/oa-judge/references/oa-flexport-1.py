import sys

if hasattr(sys, 'set_int_max_str_digits'):
    sys.set_int_max_str_digits(0)

def solve(raw):
    data = list(map(int, raw.split()))
    n = data[0]
    frequency = [0] * 100001
    for value in data[1:]:
        frequency[value] += 1
    ending = answer = 0
    for count in frequency[1:]:
        ending = count * (ending + 1)
        answer += ending
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
