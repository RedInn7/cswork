#include <cstdio>
#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;static char buf[128];vector<string> w(n);
unordered_map<string,vector<int>> groups;groups.reserve(2*n+1);
for(int i=0;i<n;i++){scanf("%127s",buf);w[i]=buf;string k=w[i];sort(k.begin(),k.end());groups[k].push_back(i);}
for(auto &g:groups)sort(g.second.begin(),g.second.end(),[&](int a,int b){return w[a]<w[b];});
int q;scanf("%d",&q);string out;
for(int i=0;i<q;i++){scanf("%127s",buf);string k=buf;sort(k.begin(),k.end());auto it=groups.find(k);
 if(it==groups.end()){out+="0\n";continue;}
 {int c=0;string t;for(int j:it->second)if(w[j]!=buf){c++;t+=' ';t+=w[j];}out+=to_string(c);out+=t;}out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
