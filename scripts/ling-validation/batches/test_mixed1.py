"""Original non-scalar fixture checks; no downloaded solution execution."""
import io,random,sys,unittest
from collections import Counter
from unittest.mock import patch
from .mixed1 import PROBLEMS,result_text,validate

def decoded(kind,text):
 if not text.endswith('\n'):raise ValueError('missing newline')
 if kind=='string':
  v=text[:-1]
  if '\n' in v or '\r' in v:raise ValueError('multiline')
  return v
 head,body=text.split('\n',1);n=int(head)
 v=(body[:-1].split('\n') if body else []) if kind=='string-set' else list(map(int,body.split()))
 if len(v)!=n:raise ValueError('count')
 if kind.endswith('-set'):
  if len(v)!=len(set(v)):raise ValueError('duplicates')
  v=sorted(v)
 return v

class MixedFirstBatchTest(unittest.TestCase):
 def same(self,p,x,y):
  self.assertEqual(sorted(x) if p['resultKind'].endswith('-set') else x,sorted(y) if p['resultKind'].endswith('-set') else y)
 def test_known_answers(self):
  known={12:'MMMDCCXLIX',71:'/home',151:'blue is sky the',917:'dc-ba',179:'210',345:'AceCreIm',541:'bacdfeg',557:"s'teL ekat edoCteeL tsetnoc",1047:'ca',1071:'ABC',1209:'aa',1544:'leetcode',2000:'dcbaefd',2390:'lecoe',238:[24,12,8,6],338:[0,1,1,2,1,2],739:[1,1,4,2,1,1,0,0],763:[9,7,8],977:[0,1,9,16,100],1356:[0,1,2,4,8,3,5,6,7],1475:[4,2,4,2,3],1652:[12,10,16,13],1720:[1,0,2,1],1920:[0,1,2,4,5,3],2433:[5,7,2,3,2],17:['ad','ae','af','bd','be','bf','cd','ce','cf'],22:['((()))','(()())','(())()','()(())','()()()'],260:[3,5],438:[0,6],442:[2,3]}
  self.assertEqual(set(known),set(PROBLEMS))
  for pid,want in known.items():
   with self.subTest(pid=pid):self.same(PROBLEMS[pid],PROBLEMS[pid]['oracle'](PROBLEMS[pid]['edges'][0]),want)
 def test_cases_codec_types_and_output_budget(self):
  for pid,p in PROBLEMS.items():
   rng=random.Random(20260905+pid);small=p['edges']+[p['random_args'](rng) for _ in range(120)]
   for args in small+[a for a,_ in p['pressure']]:
    p['validate'](args);scope={'sys':sys}
    with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
    self.assertEqual(scope['args'],args)
   for v in [p['oracle'](a) for a in small]+[v for _,v in p['pressure']]:
    kind=p['resultKind']
    with self.subTest(pid=pid):
     if kind=='string':self.assertIs(type(v),str);self.assertNotIn('\n',v);self.assertNotIn('\r',v)
     else:
      self.assertIs(type(v),list)
      for x in v:self.assertIs(type(x),str if kind=='string-set' else int)
      if kind.endswith('-set'):self.assertEqual(len(v),len(set(v)))
     text=result_text(kind,v);self.assertLessEqual(len(text.encode()),p['outputLimit']*1024);self.same(p,decoded(kind,text),v)
 def test_empty_results_and_duplicate_rejection(self):
  self.assertEqual(result_text('string',''),'\n');self.assertEqual(result_text('integer-set',[]),'0\n')
  self.assertEqual(result_text('string-set',['']),'1\n\n')
  self.assertEqual(decoded('string-set','2\n a \n\n'),['',' a '])
  for kind,text in [('integer-set','2\n1 1\n'),('string-set','2\na\na\n')]:
   with self.assertRaises(ValueError):decoded(kind,text)
 def test_bad_constraints(self):
  bad={12:[4000],71:['a/b'],151:['   '],917:['"'],179:[[-1]],345:['\t'],541:['a',0],557:[' a'],1047:['A'],1071:['a','A'],1209:['a',1],1544:['1'],2000:['abc','ab'],2390:['*a'],238:[[30]*7],338:[-1],739:[[29]],763:['A'],977:[[1,-1]],1356:[[-1]],1475:[[0]],1652:[[1],1],1720:[[],0],1920:[[0,0]],2433:[[1000001]],17:[''],22:[0],260:[[1,1]],438:['','a'],442:[[1,1,1]]}
  for pid,a in bad.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):validate(pid,a)
 def test_mutant_witnesses(self):
  for pid,p in PROBLEMS.items():
   killed=False
   for args in p['edges']:
    output=io.StringIO()
    with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(p['mutants'][0]['source'],{})
    try:v=decoded(p['resultKind'],output.getvalue())
    except ValueError:killed=True;break
    want=p['oracle'](args)
    if p['resultKind'].endswith('-set'):want=sorted(want)
    if v!=want:killed=True;break
   self.assertTrue(killed,f'{pid} lacks witness')
 def test_pressure_answers(self):
  for pid,p in PROBLEMS.items():
   for args,want in p['pressure']:
    a=args[0]
    if pid==179:answer='0' if not any(a) else str(a[0])*len(a)
    elif pid in (1047,1209,1544,2390):
     stack=[]
     for c in a:
      if pid==2390:
       if c=='*':stack.pop()
       else:stack.append(c)
      elif pid==1544:
       if stack and stack[-1]!=c and stack[-1].lower()==c.lower():stack.pop()
       else:stack.append(c)
      else:
       k=args[1] if pid==1209 else 2
       if stack and stack[-1][0]==c:stack[-1][1]+=1
       else:stack.append([c,1])
       if stack[-1][1]==k:stack.pop()
     answer=''.join(stack) if pid in (1544,2390) else ''.join(c*n for c,n in stack)
    elif pid==238:
     answer=[1]*len(a);acc=1
     for i,x in enumerate(a):answer[i]=acc;acc*=x
     acc=1
     for i in range(len(a)-1,-1,-1):answer[i]*=acc;acc*=a[i]
    elif pid==739:
     answer=[0]*len(a);stack=[]
     for i,t in enumerate(a):
      while stack and a[stack[-1]]<t:j=stack.pop();answer[j]=i-j
      stack.append(i)
    elif pid in (260,442):answer=[x for x,n in Counter(a).items() if n==(1 if pid==260 else 2)]
    elif pid==438:
     s,pattern=args;k=len(pattern);target=Counter(pattern);window=Counter(s[:k]);answer=[]
     for i in range(len(s)-k+1):
      if i:
       window[s[i-1]]-=1
       if window[s[i-1]]==0:del window[s[i-1]]
       window[s[i+k-1]]+=1
      if window==target:answer.append(i)
    else:answer=p['oracle'](args)
    with self.subTest(pid=pid):self.same(p,answer,want)

if __name__=='__main__':unittest.main()
