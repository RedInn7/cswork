"""Shared TS/Python output fixtures, typed records, and sandbox-command tests."""
import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch
import result_contract as contract
import verify

class ResultContractTests(unittest.TestCase):
    def test_shared_typescript_checker_fixtures(self):
        fixture=json.loads((Path(__file__).resolve().parents[2]/'fixtures/oj-output-checkers.json').read_text())
        self.assertEqual(fixture['maxOutputBytes'],contract.MAX_OUTPUT_BYTES)
        self.assertEqual(fixture['maxSetItems'],contract.MAX_SET_ITEMS)
        for case in fixture['cases']:
            with self.subTest(name=case['name']):
                self.assertEqual(contract.compare_output(case['checker'],case['actual'],case['expected']),case['matches'])
                for side in ('actual','expected'):
                    if side+'Valid' in case:
                        self.assertEqual(contract.parse_set_output(case[side],case['checker']) is not None,case[side+'Valid'])

    def test_counted_canonical_outputs_preserve_empty_elements(self):
        values=[('integer',-3,'-3\n'),('string','','\n'),('string',' a ',' a \n'),
                ('integer-array',[],'0\n'),('integer-array',[2,2,-1],'3\n2 2 -1\n'),
                ('integer-set',[3,1],'2\n3 1\n'),('string-set',[],'0\n'),
                ('string-set',['',' a '],'2\n\n a \n')]
        for kind,value,text in values:
            with self.subTest(kind=kind,value=value):
                self.assertEqual(contract.format_result(kind,value),text)
                contract.validate_expected_output(kind,text)

    def test_result_types_are_strict_and_sets_do_not_deduplicate(self):
        bad=[('integer',True),('integer',1.0),('integer-array',[True]),
             ('integer-array',[1.0]),('integer-array',['1']),('integer-array',{}),
             ('integer-set',[1,1]),('string-set',['a','a']),('string-set',['a\n']),
             ('string-set',['a\r']),('string-set',[1]),('string','a\0b'),('string','\ud800'),
             ('string','a\n'),('string','a\rb'),('string','\r\n')]
        for kind,value in bad:
            with self.subTest(kind=kind,value=value),self.assertRaises(ValueError):contract.validate_result(kind,value)

    def test_jsonl_preserves_record_boundaries_and_typed_values(self):
        self.assertTrue(contract.compare_batch('[1,2]\n[3]\n',[[1,2],[3]],'integer-array','jsonl-v1'))
        self.assertFalse(contract.compare_batch('1 2 3',[[1,2],[3]],'integer-array','jsonl-v1'))
        self.assertFalse(contract.compare_batch('[1]\n[2,3]\n',[[1,2],[3]],'integer-array','jsonl-v1'))
        self.assertFalse(contract.compare_batch('[1,2]\n[3]\n\n',[[1,2],[3]],'integer-array','jsonl-v1'))
        self.assertFalse(contract.compare_batch('[1,2]\n',[[1,2],[3]],'integer-array','jsonl-v1'))
        for output in ('[true]\n','[1.0]\n','["1"]\n','[NaN]\n'):
            self.assertFalse(contract.compare_batch(output,[[1]],'integer-array','jsonl-v1'))
        self.assertTrue(contract.compare_batch('[2,1]\n',[[1,2]],'integer-set','jsonl-v1'))
        self.assertFalse(contract.compare_batch('[1,1]\n',[[1]],'integer-set','jsonl-v1'))
        self.assertFalse(contract.compare_batch('"a\\nb"\n""\n',['a\nb',''],'string','jsonl-v1'))
        self.assertTrue(contract.compare_batch('" a "\n""\n',[' a ',''],'string','jsonl-v1'))
        self.assertFalse(contract.compare_batch('"a\\rb"\n',['ab'],'string','jsonl-v1'))
        self.assertFalse(contract.compare_batch('" a"\n',['a'],'string','jsonl-v1'))
        self.assertTrue(contract.compare_batch('1\n2\n',[1,2]))
        self.assertFalse(contract.compare_batch('1\u00a02',[1,2]))
        self.assertFalse(contract.compare_batch('true\n',[1],'integer','jsonl-v1'))
        self.assertFalse(contract.compare_batch('1\n',[1],'integer','unknown'))

    def test_formal_string_is_one_terminated_line(self):
        for text in ('\n','\r\n',' a \n',' a \r\n'):
            contract.validate_expected_output('string',text)
        for text in ('','a','a\r','a\nb\n','a\n\n','a\rb\n'):
            with self.subTest(text=text),self.assertRaises(ValueError):
                contract.validate_expected_output('string',text)
        # Formal-data validation does not alter the existing exact checker.
        self.assertTrue(contract.compare_output('exact','a\r\nb\r\n','a\nb\n'))
        self.assertFalse(contract.compare_output('exact','a','a\n'))

    def test_mutation_checks_use_the_formal_checker(self):
        cases=[dict(name='sample',input='',expectedOutput='a\n')]
        runner=lambda *_:{'status':'Accepted','files':{'stdout':' a\n'}}
        self.assertTrue(verify.check_mutation({'name':'extra space','source':'authored'},cases,runner,'exact')['passed'])
        self.assertFalse(verify.check_mutation({'name':'extra space','source':'authored'},cases,runner,'tokens')['passed'])
        cases[0]['expectedOutput']='2\n1 2\n'
        runner=lambda *_:{'status':'Accepted','files':{'stdout':'2\n2 1\n'}}
        self.assertFalse(verify.check_mutation({'name':'reordered','source':'authored'},cases,runner,'int-set')['passed'])

    def test_declared_resource_limits_are_applied_to_go_judge(self):
        response=io.BytesIO(b'[{"status":"Accepted","files":{"stdout":"ok"}}]')
        with patch.object(verify.urllib.request,'urlopen',return_value=response) as mocked:
            verify.run('# authored, not executed','',True,problem={'timeLimit':0.25,'memoryLimit':32768,'outputLimit':4096})
        request=mocked.call_args.args[0]
        cmd=json.loads(request.data)['cmd'][0]
        self.assertEqual(cmd['cpuLimit'],250000000)
        self.assertEqual(cmd['clockLimit'],3000000000)
        self.assertEqual(cmd['memoryLimit'],32768*1024)
        self.assertEqual(cmd['files'][1]['max'],4096*1024)
        self.assertEqual(cmd['files'][2]['max'],65536)
        self.assertIn('--batch',cmd['args'])

    def test_explicit_invalid_limits_never_fall_back_to_defaults(self):
        for field,values in [('timeLimit',[None,True,0,10.1,float('nan')]),
                             ('memoryLimit',[None,True,16383,524289,262144.0]),
                             ('outputLimit',[None,True,0,4097,64.0])]:
            for value in values:
                with self.subTest(field=field,value=value),self.assertRaises(ValueError):
                    contract.resource_limits({field:value})
        self.assertEqual(contract.resource_limits({}),{'timeLimit':2,'memoryLimit':262144,'outputLimit':64})

if __name__=='__main__':unittest.main()
