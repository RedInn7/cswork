import unittest
from linked_codec import ListNode,from_values,to_values

class LinkedCodecTests(unittest.TestCase):
    def test_roundtrip(self):
        for values in [[],[0],[-1,0,1],[5]*100000]:
            self.assertEqual(to_values(from_values(values)),values)

    def test_strict_transport(self):
        for values in [None,[True],[1.0],['1'],[0]*100001]:
            with self.assertRaises(ValueError):from_values(values)

    def test_cycle_and_invalid_return(self):
        node=ListNode(1);node.next=node
        with self.assertRaises(ValueError):to_values(node)
        with self.assertRaises(ValueError):to_values(ListNode(True))
