import sys

MONTHS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
PREFIX = (0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334)

def is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

def ordinal(year, month, day):
    previous = year - 1
    total = 365 * previous + previous // 4 - previous // 100 + previous // 400
    total += PREFIX[month - 1]
    if month > 2 and is_leap(year):
        total += 1
    return total + day - 1

def solve(raw):
    y1, m1, d1, y2, m2, d2 = map(int, raw.split())
    return str(ordinal(y2, m2, d2) - ordinal(y1, m1, d1))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
