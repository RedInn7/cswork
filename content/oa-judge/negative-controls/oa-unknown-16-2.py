import sys
def solve(raw):
 a,b=raw.splitlines()[:2];return str(min(len(a),len(b))/max(len(a),len(b)))
if __name__=='__main__':print(solve(sys.stdin.read()))
