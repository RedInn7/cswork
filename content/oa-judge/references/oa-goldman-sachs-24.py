import sys
def solve(raw):
 lines=raw.splitlines(); n=int(lines[0]); answers=[]
 for simulation in lines[1:1+n]:
  inside=best=0
  for event in simulation:
   if event in 'CU': inside+=1
   else: inside-=1
   best=max(best,inside)
  answers.append(str(best))
 return ' '.join(answers)
if __name__ == '__main__':
 print(solve(sys.stdin.read()))
