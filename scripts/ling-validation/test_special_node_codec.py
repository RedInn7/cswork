"""Synthetic node graphs only: never executes downloaded references."""
import unittest
from special_node_codec import prepare_special,finish_special,special_symbols,TreeNode,ListNode,RandomNode,CircularNode

class SpecialCodec(unittest.TestCase):
 def test_cycle_identity_and_readonly(self):
  args,ctx=prepare_special(142,[[7,7,7],1]);head=args[0]
  self.assertIs(head.next.next.next,head.next)
  self.assertEqual(finish_special(142,head.next,ctx),1)
  with self.assertRaises(ValueError):finish_special(142,ListNode(7),ctx)
  head.next=None
  with self.assertRaises(ValueError):finish_special(142,head,ctx)
  args,ctx=prepare_special(141,[[],-1]);self.assertEqual(finish_special(141,False,ctx),0)
 def test_shared_tail_and_equal_value_distinction(self):
  (a,b),ctx=prepare_special(160,[[5],[5],[5,5]])
  self.assertIsNot(a,b);self.assertIs(a.next,b.next)
  self.assertEqual(finish_special(160,a.next,ctx),2)
  (a,b),ctx=prepare_special(160,[[5],[5],[]]);self.assertIsNot(a,b);self.assertEqual(finish_special(160,None,ctx),-1)
 def test_random_copy_graph_and_aliases(self):
  (head,),ctx=prepare_special(138,[[[7,1],[7,0],[9,-1]]])
  copied=[RandomNode(7),RandomNode(7),RandomNode(9)]
  copied[0].next=copied[1];copied[1].next=copied[2];copied[0].random=copied[1];copied[1].random=copied[0]
  self.assertEqual(finish_special(138,copied[0],ctx),[[7,1],[7,0],[9,-1]])
  with self.assertRaises(ValueError):finish_special(138,head,ctx)
  copied[0].random=head
  with self.assertRaises(ValueError):finish_special(138,copied[0],ctx)
 def test_circular_insert_legal_positions(self):
  for after,want in [(0,[1,2,1]),(1,[1,1,2])]:
   (head,value),ctx=prepare_special(708,[[1,1],2]);old=ctx['nodes'][after];new=CircularNode(value,old.next);old.next=new
   self.assertEqual(finish_special(708,head,ctx),want)
  (head,value),ctx=prepare_special(708,[[],3]);new=CircularNode(3);new.next=new
  self.assertEqual(finish_special(708,new,ctx),[3])
 def test_multilevel_prev_child_and_identity(self):
  (head,),ctx=prepare_special(430,[[[1,1,2],[1,-1,-1],[1,-1,-1]]]);nodes=ctx['nodes']
  self.assertIs(nodes[1].prev,head);self.assertIsNone(nodes[2].prev)
  head.next=nodes[2];head.child=None;nodes[2].prev=head;nodes[2].next=nodes[1];nodes[1].prev=nodes[2]
  self.assertEqual(finish_special(430,head,ctx),[0,2,1])
  nodes[1].prev=head
  with self.assertRaises(ValueError):finish_special(430,head,ctx)
 def test_connect_next_ids_preserve_structure(self):
  for pid in (116,117):
   (root,),ctx=prepare_special(pid,[[1,1,1]]);root.left.next=root.right
   self.assertEqual(finish_special(pid,root,ctx),[-1,2,-1])
   root.left.next=TreeNode(1)
   with self.assertRaises(ValueError):finish_special(pid,root,ctx)
 def test_lca_and_external_nodes(self):
  for pid in (236,235):
   (root,p,q),ctx=prepare_special(pid,[[2,1,3],1,2]);self.assertEqual(finish_special(pid,root,ctx),0)
  (p,q),ctx=prepare_special(1650,[[2,1,3],1,2]);self.assertIs(p.parent,q.parent)
  self.assertEqual(finish_special(1650,p.parent,ctx),0)
  (root,p,q),ctx=prepare_special(1644,[[2,1,3],{'id':1},{'external':4}]);self.assertIsNot(q,root.right)
  self.assertEqual(finish_special(1644,None,ctx),-1)
  with self.assertRaises(ValueError):finish_special(1644,q,ctx)
  (root,),ctx=prepare_special(1123,[[2,1,3]]);self.assertEqual(finish_special(1123,root,ctx),0)
  (root,p),ctx=prepare_special(285,[[2,1,3],1]);self.assertEqual(finish_special(285,root,ctx),0)
 def test_bst_to_doubly_circular_identity(self):
  (root,),ctx=prepare_special(426,[[2,1,3]]);order=[root.left,root,root.right]
  for i,u in enumerate(order):u.left=order[(i-1)%3];u.right=order[(i+1)%3]
  self.assertEqual(finish_special(426,order[0],ctx),[1,0,2])
  order[1].left=order[2]
  with self.assertRaises(ValueError):finish_special(426,order[0],ctx)
 def test_forest_roots_and_duplicate_subtree_representatives(self):
  (root,delete),ctx=prepare_special(1110,[[1,2,3], [1]])
  self.assertEqual(finish_special(1110,[root.right,root.left],ctx),[2,1])
  (root,),ctx=prepare_special(652,[[1,2,2]])
  self.assertEqual(finish_special(652,[root.left],ctx),[1]);self.assertEqual(finish_special(652,[root.right],ctx),[2])
  with self.assertRaises(ValueError):finish_special(652,[TreeNode(2)],ctx)
 def test_distance_target_identity(self):
  (root,target,k),ctx=prepare_special(863,[[3,5,1],1,1])
  self.assertIs(target,root.left);self.assertEqual(k,1)
  self.assertEqual(finish_special(863,[3],ctx),[3])
 def test_transport_guards_and_constructor_shapes(self):
  for pid,args in [(142,[[1],1]),(138,[[[1,1]]]),(430,[[[1,0,-1]]]),(430,[[[1,1,1],[2,-1,-1]]]),(117,[[1,None,None,2]])]:
   with self.subTest(pid=pid),self.assertRaises(ValueError):prepare_special(pid,args)
  cls=special_symbols(430)['Node'];u=cls(1,None,None,None);self.assertIsNone(u.child)
  cls=special_symbols(116)['Node'];u=cls(1,None,None,None);self.assertIsNone(u.next)

if __name__=='__main__':unittest.main()
