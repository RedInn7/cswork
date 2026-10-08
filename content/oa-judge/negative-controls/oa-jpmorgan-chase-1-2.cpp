#include <cstdio>
#include <vector>
#include <string>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long> a(n);for(auto &x:a)scanf("%lld",&x);
int k;scanf("%d",&k);vector<int> flip(n+1,0);
for(int i=0;i<k;i++){int l,r;scanf("%d %d",&l,&r);flip[l-1]++;flip[r]--;}
string out;out.reserve((size_t)n*12);int cur=0;char buf[24];
for(int i=0;i<n;i++){cur+=flip[i];long long v=cur?-a[i]:a[i];int len=snprintf(buf,sizeof buf,"%lld",v);if(i)out+=' ';out.append(buf,len);}
out+='\n';fwrite(out.data(),1,out.size(),stdout);}
