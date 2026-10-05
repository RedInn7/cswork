import sys
def solve(raw):
 s=raw.strip(); best_char=''; best_len=0; best_start=-1; i=0
 while i<len(s):
  j=i+1
  while j<len(s) and s[j]==s[i]: j+=1
  if j-i>best_len or (j-i==best_len and i>best_start):
   best_len=j-i; best_char=s[i]; best_start=i
  i=j
 return f"{best_char}{best_len}"
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
