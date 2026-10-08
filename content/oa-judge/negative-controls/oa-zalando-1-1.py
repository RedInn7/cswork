import sys
a, b, c = map(int, sys.stdin.read().split())
x, y = 2*a+b, 2*c+b
out = ''
while x or y:
    chosen = None
    for ch, left in sorted((('A', x), ('B', y)), key=lambda z: (-z[1], z[0])):
        if left and not out.endswith(ch*2):
            chosen = ch
            break
    if chosen is None: break
    out += chosen
    if chosen == 'A': x -= 1
    else: y -= 1
print(out)
