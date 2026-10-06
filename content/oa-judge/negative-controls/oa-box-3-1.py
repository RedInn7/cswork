# 忽略圆环回绕，只走直线
import json,sys
def solve(raw):
 d=json.loads(raw); s=d["startIndex"]; t=d["flavors"].index(d["target"]); return str(abs(t-s))
if __name__=="__main__": print(solve(sys.stdin.read()))
