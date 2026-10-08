#include <cstdio>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;long long th;if(scanf("%d %lld",&n,&th)!=2)return 0;vector<pair<string,long long>>a(n);char buf[32];
for(int i=0;i<n;i++){long long t;scanf("%lld %31s",&t,buf);a[i]={buf,t};}
sort(a.begin(),a.end());vector<string>res;
for(int i=1;i<n;i++)if(a[i].first==a[i-1].first&&a[i].second-a[i-1].second>=th&&(res.empty()||res.back()!=a[i].first))res.push_back(a[i].first);
string out=to_string(res.size())+"\n";for(auto&s:res){out+=s;out+='\n';}fwrite(out.data(),1,out.size(),stdout);}
