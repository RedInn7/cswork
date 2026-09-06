import contextlib,io,json,sys,unittest
from unittest.mock import patch
from generate_batch import wrapper

SOURCE='''class CounterBox:
    def __init__(self, value): self.value=value
    def add(self, value): self.value+=value
    def get(self): return self.value
    def positive(self): return self.value>0
'''

class DesignWrapperTests(unittest.TestCase):
    def spec(self):
        return dict(designClass='CounterBox',designMethods=['add','get','positive'],resultKind='nullable-integer-array',parse='args=[json.loads(sys.stdin.readline()),json.loads(sys.stdin.readline())]')

    def execute(self,source,text,batch=False):
        output=io.StringIO()
        with patch.object(sys,'argv',['fixture']+(['--batch'] if batch else [])),patch.object(sys,'stdin',io.StringIO(text)),contextlib.redirect_stdout(output):
            exec(source,{'__name__':'__main__'})
        return output.getvalue()

    def test_state_isolated_and_typed(self):
        code=wrapper(self.spec(),SOURCE)
        args=[['CounterBox','add','get','positive'],[[0],[3],[],[]]]
        self.assertEqual(self.execute(code,'\n'.join(map(json.dumps,args))+'\n'),'4\nnull null 3 1\n')
        self.assertEqual(self.execute(code,json.dumps([args,args]),True),'[null, null, 3, 1]\n'*2)

    def test_reject_undeclared_operations_and_noninteger_results(self):
        code=wrapper(self.spec(),SOURCE)
        for operations,params in [(['other'],[[0]]),(['CounterBox','__class__'],[[0],[]]),(['CounterBox','get'],[[0]])]:
            with self.assertRaises(ValueError):self.execute(code,json.dumps([[operations,params]]),True)
        with self.assertRaises(ValueError):self.execute(wrapper(self.spec(),SOURCE.replace('return self.value\n','return "3"\n')),json.dumps([[['CounterBox','get'],[[0],[]]]]),True)

    def test_metadata_cannot_inject_identifiers(self):
        for update in [dict(designClass='a();'),dict(designMethods=['__getattribute__']),dict(designMethods=['get','get'])]:
            with self.assertRaises(ValueError):wrapper({**self.spec(),**update},SOURCE)
