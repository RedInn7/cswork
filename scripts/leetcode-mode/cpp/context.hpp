#ifndef CSWORK_LEETCODE_CONTEXT
#define CSWORK_LEETCODE_CONTEXT
#include <bits/stdc++.h>
using namespace std;
// The judge's own node types. The runtime uses only cswork_platform::X; the
// harness defines X at global scope (as LeetCode does) only when the problem's
// signature uses it, so learners may name their own types anything else.
namespace cswork_platform {
struct TreeNode {
    int val; TreeNode *left, *right;
    TreeNode(int v=0, TreeNode* l=nullptr, TreeNode* r=nullptr):val(v),left(l),right(r){}
    static void operator delete(void*) noexcept {}
};
struct ListNode {
    int val; ListNode* next;
    ListNode(int v=0,ListNode* n=nullptr):val(v),next(n){}
    static void operator delete(void*) noexcept {}
};
class Node {
public:
    int val; Node *left=nullptr,*right=nullptr,*next=nullptr,*random=nullptr,*prev=nullptr,*child=nullptr,*parent=nullptr;
    Node(int v=0):val(v){}
    Node(int v,Node* n):val(v),next(n){}
    Node(int v,Node* l,Node* r):val(v),left(l),right(r){}
    Node(int v,Node* l,Node* r,Node* n):val(v),left(l),right(r),next(n){}
    static void operator delete(void*) noexcept {}
};
class Interval {
public:
    int start=0,end=0;
    Interval()=default;
    Interval(int s,int e):start(s),end(e){}
};
class MountainArray {
public:
    vector<int> values; int calls=0;
    int get(int index) { if(++calls>100) throw runtime_error("MountainArray.get exceeded 100 calls"); return values.at(index); }
    int length() { return static_cast<int>(values.size()); }
};
} // namespace cswork_platform
#endif
