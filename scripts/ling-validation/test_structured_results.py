import json,unittest
from pathlib import Path
import result_contract as c

class StructuredResults(unittest.TestCase):
    def test_shared_shapes(self):
        for item in json.loads((Path(__file__).resolve().parents[2]/'fixtures/oj-structured-results.json').read_text()):
            with self.subTest(item=item):
                if item['valid']:c.validate_expected_output(item['kind'],item['output'])
                else:
                    with self.assertRaises(ValueError):c.validate_expected_output(item['kind'],item['output'])

    def test_types_and_invocation_boundaries(self):
        for kind,value in [('nullable-integer-array',[1,None,2**60]),('integer-rows',[[],[1,-2],[2**60]])]:
            out=c.format_result(kind,value);c.validate_expected_output(kind,out)
            self.assertTrue(c.compare_batch(json.dumps(value)+'\n',[value],kind,'jsonl-v1'))
            self.assertFalse(c.compare_batch(json.dumps(value)+'\n\n',[value],kind,'jsonl-v1'))
        for kind,value in [('nullable-integer-array',[True]),('nullable-integer-array',[1.0]),('integer-rows',[[None]]),('integer-rows',[1]),('integer-rows',[[True]])]:
            with self.assertRaises(ValueError):c.validate_result(kind,value)
        self.assertFalse(c.same_result('integer-rows',[[1],[2]],[[2],[1]]))
