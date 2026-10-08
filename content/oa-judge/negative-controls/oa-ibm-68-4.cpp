#include <cstdio>
#include <string>
#include <vector>
#include <map>
#include <algorithm>
using namespace std;
int main(){int n;long long th;scanf("%d %lld",&n,&th);map<string,vector<long long>>g;vector<string>order;char buf[32];
for(int i=0;i<n;i++){long long t;scanf("%lld %31s",&t,buf);if(!g.count(buf))order.push_back(buf);g[buf].push_back(t);}
vector<string>res;for(auto&s:order){auto&v=g[s];sort(v.begin(),v.end());for(size_t i=1;i<v.size();i++)if(v[i]-v[i-1]>th){res.push_back(s);break;}}
printf("%d\n",(int)res.size());for(auto&s:res)printf("%s\n",s.c_str());}
