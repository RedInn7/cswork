#include <cstdio>
#include <cstring>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;
int main(){int n;long long target;if(scanf("%d %lld",&n,&target)!=2)return 0;vector<long long>fl(n);vector<int>fr(n);char buf[64];long long base=0;
for(int i=0;i<n;i++){scanf("%63s",buf);char*d=strchr(buf,'.');long long ip=atoll(buf);int f=0;if(d){f=(d[1]-'0')*10+(d[2]?d[2]-'0':0);}fl[i]=ip;fr[i]=f;base+=ip;}
long long k=target-base;vector<int>idx;for(int i=0;i<n;i++)if(fr[i]>0)idx.push_back(i);
sort(idx.begin(),idx.end(),[&](int a,int b){return fr[a]!=fr[b]?fr[a]<fr[b]:a<b;});
vector<long long>y=fl;for(long long t=0;t<k;t++)y[idx[t]]++;
string out;for(int i=0;i<n;i++){out+=to_string(y[i]);out+=i+1<n?' ':'\n';}fwrite(out.data(),1,out.size(),stdout);}
