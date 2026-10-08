#include <cstdio>
#include <string>
using namespace std;
int main(){string s;s.reserve(1<<25);char buf[1<<16];size_t k;
while((k=fread(buf,1,sizeof buf,stdin))>0)s.append(buf,k);
long long cnt[26]={0};for(char c:s)if(c>='a'&&c<='z')cnt[c-'a']++;
long long n=0;for(int i=0;i<26;i++)n+=cnt[i];
string out(n,'?');long long l=n%2,r=n-1;
for(int i=0;i<26;i++){for(long long k2=0;k2<cnt[i]/2;k2++){out[l++]=char('a'+i);out[r--]=char('a'+i);}if(cnt[i]%2)out[0]=char('a'+i);}
out+='\n';fwrite(out.data(),1,out.size(),stdout);}
