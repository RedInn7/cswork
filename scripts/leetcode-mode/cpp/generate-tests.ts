import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { buildLeetCodeCpp, getLeetCodeCppTemplate, getLeetCodeCppRuntime } from '../../../lib/server/leetcode-cpp';
const contracts = JSON.parse(readFileSync('lib/content/leetcode-contracts.json','utf8')).problems;
const out = process.argv[2];
if (!out) throw new Error('Output directory required');
mkdirSync(out,{recursive:true});
const cases: [number, string, Record<string, unknown>, unknown][] = [
  [1,'class Solution { public: vector<int> twoSum(vector<int>& a,int t){ for(int i=0;i<(int)a.size();i++)for(int j=i+1;j<(int)a.size();j++)if(a[i]+a[j]==t)return {i,j};return {};}};',{args:[[2,7,11,15],9],nodes:[]},[0,1]],
  [48,'class Solution { public: void rotate(vector<vector<int>>& a){ swap(a[0][0],a[0][1]); }};',{args:[[[1,2],[3,4]]],nodes:[]},null],
  [142,'class Solution { public: ListNode* detectCycle(ListNode* head){return head->next;}};',{args:[{$ref:0}],nodes:[{id:0,type:'ListNode',fields:{val:1,next:{$ref:1}}},{id:1,type:'ListNode',fields:{val:2,next:{$ref:0}}}]},{$ref:1}],
  [138,'class Solution { public: Node* copyRandomList(Node* head){auto p=new Node(head->val);p->random=p;return p;}};',{args:[{$ref:0}],nodes:[{id:0,type:'Node',fields:{val:7,next:null,random:{$ref:0}}}]},{$ref:1}],
  [146,'class LRUCache { map<int,int> m; public: LRUCache(int n){} int get(int k){return m.count(k)?m[k]:-1;} void put(int k,int v){m[k]=v;}};',{kind:'design',args:[],nodes:[],operations:['LRUCache','put','get','get'],parameters:[[2],[1,5],[1],[8]]},[null,null,5,-1]],
  [297,'class Codec { public: string serialize(TreeNode* root){return root?to_string(root->val):"#";} TreeNode* deserialize(string data){return data=="#"?nullptr:new TreeNode(stoi(data));}};',{kind:'codec',operation:'serialize',args:[{$ref:0},null],nodes:[{id:0,type:'TreeNode',fields:{val:12,left:null,right:null}}]},['12','#']],
  [297,'class Codec { public: string serialize(TreeNode* root){return root?to_string(root->val):"#";} TreeNode* deserialize(string data){return data=="#"?nullptr:new TreeNode(stoi(data));}};',{kind:'codec',operation:'deserialize',args:['12','#'],nodes:[]},[{$ref:0},null]],
  [759,'class Solution {public: vector<Interval> employeeFreeTime(vector<vector<Interval>> schedule){return {Interval(schedule[0][0].end,schedule[1][0].start)};}};',{args:[[[{$ref:0}],[{$ref:1}]]],nodes:[{id:0,type:'Interval',fields:{start:1,end:3}},{id:1,type:'Interval',fields:{start:5,end:9}}]},[{$ref:2}]],
  [1095,'class Solution {public:int findInMountainArray(int target,MountainArray& a){for(int i=0;i<a.length();i++)if(a.get(i)==target)return i;return -1;}};',{args:[2,{$ref:0}],nodes:[{id:0,type:'MountainArray',fields:{values:[1,3,2]}}]},2],
  [344,'class Solution {public:void reverseString(vector<char>& a){reverse(a.begin(),a.end());}};',{args:[['a','b']],nodes:[]},null],
];
const tests = cases.map(([id, source, input, expected],i)=>{
  const key=`case-${i}`;
  const code = id === 142 || id === 138
    ? getLeetCodeCppTemplate(id, source)
    : source;
  writeFileSync(`${out}/${key}.cpp`,buildLeetCodeCpp(id,code,contracts[`lc-${id}`].templates.cpp));
  return {key,id,input:{version:1,problemId:id,kind:'function',...input},expected};
});
writeFileSync(`${out}/cases.json`,JSON.stringify(tests));
const context=readFileSync('scripts/leetcode-mode/cpp/context.hpp','utf8');
const runtime=getLeetCodeCppRuntime();
const entries=Object.entries(contracts) as [string,{templates:{cpp:string}}][];
const batches=[];
for(let offset=0;offset<entries.length;offset+=25){
  const rows=entries.slice(offset,offset+25);
  let text=context+'\n'+runtime+'\n';
  for(const [id,p] of rows){
    const source=buildLeetCodeCpp(Number(id.slice(3)),p.templates.cpp,p.templates.cpp);
    const driver=source.slice(source.lastIndexOf('\nint main()')).replace('int main()','int test_interface()');
    text+=`\nnamespace case_${id.replace('-','_')} {\n${p.templates.cpp}\n${driver}\n}\n`;
  }
  text+='\nint main(){return 0;}\n';
  const key=`interfaces-${offset}`;
  writeFileSync(`${out}/${key}.cpp`,text);
  batches.push({key,ids:rows.map(([id])=>id)});
}
writeFileSync(`${out}/interfaces.json`,JSON.stringify(batches));
