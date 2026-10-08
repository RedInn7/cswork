#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <unordered_map>
using namespace std;
int main(){int q;if(scanf("%d",&q)!=1)return 0;unordered_map<string,int> id;id.reserve(size_t(q)+1);
vector<string> order;vector<int> cnt;size_t p=0;char cmd[16],ip[32];string out;
for(int i=0;i<q;i++){scanf("%15s",cmd);
if(cmd[0]=='A'){scanf("%31s",ip);auto r=id.try_emplace(ip,(int)order.size());if(r.second){order.push_back(ip);cnt.push_back(0);}cnt[r.first->second]++;}
else{while(p<order.size()&&cnt[p]>=3)p++;if(p<order.size())out+=order[p];out+='\n';}}
fwrite(out.data(),1,out.size(),stdout);}
