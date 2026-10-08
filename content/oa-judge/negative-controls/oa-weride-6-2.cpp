#include <cstdio>
#include <vector>
#include <unordered_map>
#include <chrono>
#include <cstdint>
using namespace std;
struct Hash{static uint64_t mix(uint64_t x){x+=0x9e3779b97f4a7c15ULL;x=(x^(x>>30))*0xbf58476d1ce4e5b9ULL;x=(x^(x>>27))*0x94d049bb133111ebULL;return x^(x>>31);}size_t operator()(int x)const{static const uint64_t seed=chrono::steady_clock::now().time_since_epoch().count();return mix(uint64_t(x)+seed);}};
int readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();int x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return x;}
struct Edge{int to,weight;};
int main(){
 int n=readNumber(),m=readNumber();vector<vector<Edge>>adj(n);
 for(int i=0;i<m;i++){int u=readNumber()-1,v=readNumber()-1,w=readNumber()-1;adj[u].push_back({v,w});adj[v].push_back({u,w});}
 vector<int>parent(n,-1),mask(n),order(1,0);parent[0]=0;
 for(size_t i=0;i<order.size();i++){int u=order[i];for(auto e:adj[u])if(e.to!=parent[u]){parent[e.to]=u;mask[e.to]=mask[u]^(1<<e.weight);order.push_back(e.to);}}
 unordered_map<int,long long,Hash>seen;seen.reserve(n*2);long long answer=0;
 for(int u:order){int x=mask[u];auto same=seen.find(x);if(same!=seen.end())answer+=same->second;
  for(int b=0;b<26;b++){auto it=seen.find(x^(1<<b));if(it!=seen.end())answer+=it->second;}
  seen[x]++;
 }
 printf("%lld\n",answer+n);
}
