#include <cstdio>
#include <cstring>
static char s[200005];
int main(){scanf("%200004s",s);int n=strlen(s);long long c=0;
for(int i=0;i+2<n;i++)if(s[i]==s[i+1]&&s[i+1]!=s[i+2]){s[i+2]=s[i];c++;}
printf("%lld\n",c);}
