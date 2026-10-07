import json
import sys

def solve(raw):
    num_rows = int(raw.strip())
    if not 0 <= num_rows <= 30:
        raise ValueError("numRows must be between 0 and 30")
    triangle = []
    for index in range(num_rows):
        row = [1] * (index + 1)
        for column in range(1, index):
            row[column] = triangle[index - 1][column - 1] + triangle[index - 1][column]
        triangle.append(row)
    return json.dumps(triangle, separators=(",", ":"))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
