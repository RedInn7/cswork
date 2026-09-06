import {mkdirSync,writeFileSync} from 'node:fs';
import {leetcodeSource} from '../../../lib/server/leetcode-mode';
const out=process.argv[2];
if(!out)throw new Error('Output directory required');
mkdirSync(out,{recursive:true});
const cases=[
 {id:1,code:'class Solution {public: vector<int> twoSum(vector<int>& a,int t){unordered_map<int,int> m;for(int i=0;i<(int)a.size();i++){if(m.count(t-a[i]))return {m[t-a[i]],i};m[a[i]]=i;}return {};}};',runs:[{input:'4\n2 7 11 15\n9\n',tokens:['2','0','1']},{input:'[3,2,4]\n6\n',custom:true,tokens:['2','1','2']}]},
 {id:206,code:'class Solution {public: ListNode* reverseList(ListNode* head){ListNode* prev=nullptr;while(head){auto next=head->next;head->next=prev;prev=head;head=next;}return prev;}};',runs:[{input:'5\n1 2 3 4 5\n',tokens:['5','5','4','3','2','1']},{input:'[]\n',custom:true,tokens:['0']}]},
 {id:142,code:'class Solution {public: ListNode* detectCycle(ListNode* head){auto a=head,b=head;while(b&&b->next){a=a->next;b=b->next->next;if(a==b){a=head;while(a!=b){a=a->next;b=b->next;}return a;}}return nullptr;}};',runs:[{input:'[[3,2,0,-4],1]\n',tokens:['1']},{input:'[1,2]\n-1\n',custom:true,tokens:['-1']}]},
 {id:146,code:'class LRUCache {int capacity;list<pair<int,int>> q;unordered_map<int,list<pair<int,int>>::iterator> m;public:LRUCache(int n):capacity(n){}int get(int key){if(!m.count(key))return -1;auto it=m[key];int v=it->second;q.splice(q.begin(),q,it);return v;}void put(int k,int v){if(m.count(k)){q.erase(m[k]);m.erase(k);}q.emplace_front(k,v);m[k]=q.begin();if((int)q.size()>capacity){m.erase(q.back().first);q.pop_back();}}};',runs:[{input:'["LRUCache","put","put","get","put","get","put","get","get","get"]\n[[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]\n',tokens:['10','null','null','null','1','null','-1','null','-1','3','4']}]},
 {id:297,code:'class Codec {void encode(TreeNode* n,ostringstream& o){if(!n){o<<"# ";return;}o<<n->val<<" ";encode(n->left,o);encode(n->right,o);}TreeNode* decode(istringstream& in){string s;if(!(in>>s))throw runtime_error("truncated");if(s=="#")return nullptr;auto n=new TreeNode(stoi(s));n->left=decode(in);n->right=decode(in);return n;}public:string serialize(TreeNode* root){ostringstream o;encode(root,o);return o.str();}TreeNode* deserialize(string data){istringstream in(data);return decode(in);}};',codecTrees:[[1,2,3,null,null,4,5],[],[-1]]},
 {id:1095,code:'class Solution {public:int findInMountainArray(int target,MountainArray& a){for(int i=0;i<a.length();i++)if(a.get(i)==target)return i;return -1;}};',runs:[{input:'[2,[1,3,2]]\n',tokens:['2']}]},
];
for(const item of cases){const wrapped=leetcodeSource(`lc-${item.id}`,'cpp',item.code,262144);writeFileSync(`${out}/lc-${item.id}.cpp`,wrapped.source);writeFileSync(`${out}/lc-${item.id}.py`,wrapped.bridgeSource!);}
writeFileSync(`${out}/pipeline.json`,JSON.stringify(cases.map(({code:_code,...item})=>item)));
