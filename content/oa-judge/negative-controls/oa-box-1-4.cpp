#include <cstdio>
#include <cstring>
#include <string>
using namespace std;
static bool up(char c){return c>='A'&&c<='Z';}
static long long value(const char*s){int n=strlen(s);if(n<10||n>12)return 0;
for(int i=0;i<3;i++)if(!up(s[i]))return 0;if(s[0]==s[1]||s[0]==s[2]||s[1]==s[2])return 0;
int y=0;for(int i=3;i<7;i++){if(s[i]<'0'||s[i]>'9')return 0;y=y*10+s[i]-'0';}if(y<1900||y>2020)return 0;
if(!up(s[n-1]))return 0;string v(s+7,s+n-1);
const char*ok[]={"10","20","50","100","200","500","1000"};for(auto o:ok)if(v==o)return stoll(v);return 0;}
int main(){int n;if(scanf("%d",&n)!=1)return 0;char buf[64];long long total=0;
for(int i=0;i<n;i++){scanf("%63s",buf);total+=value(buf);}
printf("%lld\n",total*99/100);}
