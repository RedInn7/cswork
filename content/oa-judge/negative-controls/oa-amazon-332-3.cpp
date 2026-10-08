#include <cstdio>
#include <vector>
using namespace std;
static char buf[1<<16];static size_t len=0,pos=0;
static int gc(){if(pos==len){len=fread(buf,1,sizeof buf,stdin);pos=0;if(!len)return -1;}return buf[pos++];}
static long long rd(){int c=gc();while(c!='-'&&(c<'0'||c>'9'))c=gc();long long x=0;while(c>='0'&&c<='9'){x=x*10+(c-'0');c=gc();}return x;}
int main(){long long n=rd(),m=rd();vector<long long> a(n);long long total=0;for(auto &x:a){x=rd();total+=x;}
long long cur=0;m--;for(long long i=0;i<m;i++)cur+=a[i];long long best=cur;
for(long long i=m;i<n;i++){cur+=a[i]-a[i-m];if(cur>best)best=cur;}
printf("%lld\n",total-best);}
