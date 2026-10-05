import sys
def solve(raw):
 lines=raw.splitlines(); n=int(lines[0]); words=lines[1:1+n]; trie={}; END='#'
 for w in words:
  node=trie
  for c in w: node=node.setdefault(c,{})
  node[END]=node.get(END,0)+1
 total=0
 for w in words:
  node=trie
  for c in w:
   node=node[c]
  total+=node.get(END,0)
  total-=1
 return str(total)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
