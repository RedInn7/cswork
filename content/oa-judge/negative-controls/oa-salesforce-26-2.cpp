#include <cstdio>
#include <cstring>
#include <vector>
static char s[200005];
int main(){if(scanf("%200004s",s)!=1)return 0;int n=strlen(s);
std::vector<int>cnt((size_t)(n+1)*26,0);for(int i=0;i<n;i++){for(int c=0;c<26;c++)cnt[(size_t)(i+1)*26+c]=cnt[(size_t)i*26+c];cnt[(size_t)(i+1)*26+s[i]-'a']++;}
long long ans=0;int p=n;char tail=0;int r=n-1;
while(r>=0){int l=r;while(l>0&&s[l-1]==s[r])l--;
 if(r-l+1>=2){char y=s[r];int mid=p-(r+1);int same=cnt[(size_t)p*26+y-'a']-cnt[(size_t)(r+1)*26+y-'a'];ans+=n-(r+1);p=l;tail=y;}
 r=l-1;}
printf("%lld\n",ans);}
