#include <cstdio>
#include <cstdint>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;
vector<vector<string>> own(n);vector<string> all;char buf[64];
for(int i=0;i<n;i++){int k;scanf("%d",&k);own[i].resize(k);for(auto &s:own[i]){scanf("%63s",buf);s=buf;all.push_back(s);}}
sort(all.begin(),all.end());all.erase(unique(all.begin(),all.end()),all.end());
int P=all.size(),W=(P+63)/64;vector<uint64_t> bits((size_t)n*W+1,0);
for(int i=0;i<n;i++)for(auto &s:own[i]){int id=lower_bound(all.begin(),all.end(),s)-all.begin();bits[(size_t)i*W+id/64]|=1ULL<<(id%64);}
vector<vector<int>> g(n);vector<int> indeg(n,0);
for(int j=0;j<m;j++){int u,v;scanf("%d %d",&u,&v);uint64_t *a=&bits[(size_t)v*W];const uint64_t *b=&bits[(size_t)u*W];for(int w=0;w<W;w++)a[w]|=b[w];}
vector<int> order;order.reserve(n);for(int i=0;i<n;i++)if(!indeg[i])order.push_back(i);
for(size_t h=order.size();h<order.size();h++){int u=order[h];for(int v:g[u]){uint64_t *a=&bits[(size_t)v*W];const uint64_t *b=&bits[(size_t)u*W];for(int w=0;w<W;w++)a[w]|=b[w];if(--indeg[v]==0)order.push_back(v);}}
string out;
for(int i=0;i<n;i++){const uint64_t *b=&bits[(size_t)i*W];int c=0;for(int w=0;w<W;w++)c+=__builtin_popcountll(b[w]);out+=to_string(c);
 for(int w=0;w<W;w++){uint64_t x=b[w];while(x){int t=__builtin_ctzll(x);x&=x-1;out+=' ';out+=all[w*64+t];}}out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
