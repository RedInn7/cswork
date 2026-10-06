def solve(raw):
 s=raw.strip();v=s.count("U")-s.count("D")
 return "U" if v>0 else "D" if v<0 else ""
if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
