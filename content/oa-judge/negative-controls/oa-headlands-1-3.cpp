#include <cstdio>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <numeric>
using namespace std;
static vector<int> par;
static int findRoot(int x){while(par[x]!=x){par[x]=par[par[x]];x=par[x];}return x;}
static bool digits(string_view s){if(s.empty()||s.size()>19)return false;for(char c:s)if(c<'0'||c>'9')return false;return true;}
static uint64_t num(string_view s){uint64_t v=0;for(char c:s)v=v*10+uint64_t(c-'0');return v;}
static bool dupKeys(const vector<string_view>&t){vector<string_view> k;for(size_t i=0;i<t.size();i+=2)k.push_back(t[i]);sort(k.begin(),k.end());return adjacent_find(k.begin(),k.end())!=k.end();}
struct Commit{uint64_t id,ts;size_t pb,pe;};
int main(){string in;char buf[1<<16];size_t r;while((r=fread(buf,1,sizeof buf,stdin))>0)in.append(buf,r);
size_t p=0;auto nextLine=[&]()->string_view{size_t e=in.find('\n',p);if(e==string::npos)e=in.size();string_view s(in.data()+p,e-p);p=e<in.size()?e+1:e;return s;};
auto split=[&](string_view s,vector<string_view>&t){t.clear();size_t a=0;while(a<=s.size()){size_t b=s.find(' ',a);if(b==string_view::npos)b=s.size();t.push_back(s.substr(a,b-a));a=b+1;}};
long N=atol(string(nextLine()).c_str());vector<Commit> cs;vector<pair<string_view,string_view>> pairs;vector<string_view> tok;
for(long i=0;i<N;i++){split(nextLine(),tok);
 if(tok.size()<4||tok.size()%2||tok[0]!="id"||tok[2]!="timestamp"||!digits(tok[1])||!digits(tok[3]))continue;
 if(dupKeys(tok))continue;
 size_t pb=pairs.size();for(size_t j=4;j+1<tok.size();j+=2)pairs.push_back({tok[j],tok[j+1]});cs.push_back({num(tok[1]),num(tok[3]),pb,pairs.size()});}
int C=cs.size();par.resize(C);iota(par.begin(),par.end(),0);
unordered_map<string,int> anchor;anchor.reserve(pairs.size()*2+1);
for(int c=0;c<C;c++)for(size_t j=cs[c].pb;j<cs[c].pe;j++){string key(pairs[j].first);key+=' ';key+=pairs[j].second;
 auto it=anchor.try_emplace(move(key),c).first;int a=findRoot(c),b=findRoot(it->second);if(a!=b)par[a]=b;}
bool amb=false;{unordered_map<string,string_view> owner;owner.reserve(pairs.size()*2+1);
 for(int c=0;c<C&&!amb;c++){string pre=to_string(findRoot(c))+' ';for(size_t j=cs[c].pb;j<cs[c].pe;j++){auto it=owner.try_emplace(pre+string(pairs[j].first),pairs[j].second).first;if(it->second!=pairs[j].second){amb=true;break;}}}}
if(amb){fputs("AMBIGUOUS INPUT!\n",stdout);return 0;}
vector<vector<int>> group(C);for(int c=0;c<C;c++)group[findRoot(c)].push_back(c);
for(auto &g:group)sort(g.begin(),g.end(),[&](int a,int b){return cs[a].ts!=cs[b].ts?cs[a].ts<cs[b].ts:cs[a].id<cs[b].id;});
long R=atol(string(nextLine()).c_str());string out;
for(long q=0;q<R;q++){split(nextLine(),tok);uint64_t lo=num(tok[0]),hi=num(tok[1]);string key(tok[2]);key+=' ';key+=tok[3];
 auto it=anchor.find(key);if(it!=anchor.end()){const auto &g=group[findRoot(it->second)];
  auto s=lower_bound(g.begin(),g.end(),lo,[&](int c,uint64_t v){return cs[c].ts<v;});
  vector<uint64_t> w;for(;s!=g.end()&&cs[*s].ts<=hi;++s)w.push_back(cs[*s].id);sort(w.begin(),w.end());for(auto x:w){out+=to_string(x);out+=' ';}}
 out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
