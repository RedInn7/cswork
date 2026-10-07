import sys
def solve(raw):
    data = list(map(int, raw.split())); factor = data[1]; ratings = data[2:]
    def best(values):
        current = answer = values[0]
        for x in values[1:]:
            current = max(x, current + x); answer = max(answer, current)
        return answer
    base = best(ratings)
    gains = [(factor - 1) * x for x in ratings]
    divisions = [(abs(x)//factor)*(1 if x>=0 else -1)-x for x in ratings]
    return str(max(base, base + best(gains), base + best(divisions)))
if __name__ == "__main__":
    print(solve(sys.stdin.read()))
