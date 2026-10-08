#include <cstdio>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;long long th;if(scanf("%d %lld",&n,&th)!=2)return 0;vector<pair<string,long long>>a(n);char buf[32];
for(int i=0;i<n;i++){long long t;scanf("%lld %31s",&t,buf);a[i]={buf,t};}
sort(a.begin(),a.end());vector<string>res;
for(int i=0,j;i<n;i=j){j=i;while(j<n&&a[j].first==a[i].first)j++;if(a[j-1].second-a[i].second>th)res.push_back(a[i].first);}
string out=to_string(res.size())+"\n";for(auto&s:res){out+=s;out+='\n';}fwrite(out.data(),1,out.size(),stdout);}
