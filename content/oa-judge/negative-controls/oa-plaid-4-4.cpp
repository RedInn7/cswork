#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
static char buf[1<<16];static size_t len=0,pos=0;
static int gc(){if(pos==len){len=fread(buf,1,sizeof buf,stdin);pos=0;if(!len)return -1;}return buf[pos++];}
static long long rd(){int c=gc();while(c<'0'||c>'9')c=gc();long long x=0;while(c>='0'&&c<='9'){x=x*10+(c-'0');c=gc();}return x;}
int main(){int n=(int)rd();vector<long long> h(n);for(auto &x:h)x=rd();
vector<int> left(n),st;st.reserve(n);
for(int i=0;i<n;i++){while(!st.empty()&&h[st.back()]>=h[i])st.pop_back();left[i]=st.empty()?-1:st.back();st.push_back(i);}
st.clear();long long best=0;
for(int i=n-1;i>=0;i--){while(!st.empty()&&h[st.back()]>=h[i])st.pop_back();int right=st.empty()?n:st.back();st.push_back(i);
long long side=min<long long>(h[i],right-left[i]-1);best=max(best,side);}
printf("%lld\n",best);}
