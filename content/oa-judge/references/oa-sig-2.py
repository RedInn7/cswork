def solve(raw):
 s=raw.strip();v=s.count("U")-s.count("D")
 return "U" if v>0 else "D" if v<0 else ""
