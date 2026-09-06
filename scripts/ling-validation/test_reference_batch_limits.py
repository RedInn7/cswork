import contextlib,io,json,sys,unittest
from unittest.mock import patch
from generate_batch import wrapper
from reference_adapters import adapt_result
from result_contract import validate_result
import verify

class ReferenceTransportTests(unittest.TestCase):
 def test_explicit_tuple_adapter_keeps_typed_oracle_strict(self):
  self.assertEqual(adapt_result('integer-rows',[(1,2),[3,4]],[]),[[1,2],[3,4]])
  for result in ([True],[(True,)],[(1.0,)],[(None,)],[[[]]],{(1,2)}):
   with self.assertRaises(ValueError):adapt_result('integer-rows',result,[])
  with self.assertRaises(ValueError):validate_result('integer-rows',[(1,2)])
 def test_authored_tuple_reference_works_in_both_modes(self):
  spec=dict(method='solve',resultKind='integer-row-set',resultAdapter='integer-rows',parse='args=json.load(sys.stdin)')
  code=wrapper(spec,'class Solution:\n def solve(self,x): return [(x,2),(3,4)]\n')
  for batch,input,want in [(False,'[1]','2\n2 1 2\n2 3 4\n'),(True,'[[1],[1]]','[[1, 2], [3, 4]]\n'*2)]:
   output=io.StringIO()
   with patch.object(sys,'argv',['fixture']+(['--batch'] if batch else [])),patch.object(sys,'stdin',io.StringIO(input)),contextlib.redirect_stdout(output):exec(code,{'__name__':'__main__'})
   self.assertEqual(output.getvalue(),want)
 def test_batch_budget_does_not_change_formal_limits(self):
  commands=[]
  def request(_url,**kw):commands.append(json.loads(kw['data'])['cmd'][0]);return object()
  class Response:
   def __enter__(self):return io.StringIO('[{"status":"Accepted"}]')
   def __exit__(self,*_):pass
  with patch.object(verify.urllib.request,'Request',request),patch.object(verify.urllib.request,'urlopen',return_value=Response()):
   for batch in (False,True):verify.run('pass','',batch,{'outputLimit':64})
  self.assertEqual(commands[0]['files'][1]['max'],65536)
  self.assertEqual(commands[1]['files'][1]['max'],64*1024*1024)
  self.assertEqual(commands[1]['files'][2]['max'],65536)
  self.assertEqual(commands[0]['cpuLimit'],commands[1]['cpuLimit'])
  self.assertEqual(commands[0]['memoryLimit'],commands[1]['memoryLimit'])
