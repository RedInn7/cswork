from fractions import Fraction

LEVEL = '中等'
TAGS = ['位运算', '数学']
SAMPLES = 2
MAX_N = 40


def binary(s, limit):
    x = Fraction(s.strip())
    digits = []
    while x and len(digits) <= limit:
        x *= 2
        digits.append('1' if x >= 1 else '0')
        x -= x >= 1
    return 'ERROR' if x or len(digits) > limit else '0.' + ''.join(digits)


def solve(s):
    return binary(s, 32)


def wrong_31_bits(s):
    # Stops one digit early: 32-digit answers become ERROR.
    return binary(s, 31)


def wrong_32_characters(s):
    # Counts the "0." toward the 32 characters, leaving room for 30 digits.
    return binary(s, 30)


def decimal(f):
    """The exact decimal text of a dyadic fraction."""
    k = 0
    while (f * 10 ** k).denominator != 1:
        k += 1
    digits = str((f * 10 ** k).numerator).rjust(k, '0')
    return '0.' + digits


def size(s):
    return len(s.split()[0]) - 2  # digits after "0."


def cases(r):
    out = ['0.8125\n', '0.3\n', '0.5\n', '0.75\n', '0.2\n', '0.999\n', decimal(Fraction(1, 2**32)) + '\n',
           decimal(Fraction(2**32 - 1, 2**32)) + '\n', decimal(Fraction(1, 2**31)) + '\n', decimal(Fraction(3, 2**30)) + '\n',
           decimal(Fraction(5, 2**33)) + '\n', '0.3333\n', '0.0625\n']
    for _ in range(8):
        b = r.randint(1, 34)
        out.append(decimal(Fraction(2 * r.randrange(2 ** (b - 1)) + 1, 2 ** b)) + '\n')
    out.append(decimal(Fraction(2 * r.randrange(2**39) + 1, 2**40)) + '\n')  # 40 digits
    return out
