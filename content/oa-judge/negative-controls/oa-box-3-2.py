# 把当前位置也算作一步
import json,sys
def solve(raw):
 d=json.loads(raw); n=len(d["flavors"]); s=d["startIndex"]; t=d["flavors"].index(d["target"]); x=abs(t-s); return str(min(x,n-x)+1)
if __name__=="__main__": print(solve(sys.stdin.read()))
