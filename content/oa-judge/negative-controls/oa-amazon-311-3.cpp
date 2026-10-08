#include <cstdio>
#include <cstring>
static char s[200005];
int main(){if(scanf("%200004s",s)!=1)return 0;int n=strlen(s);int p=n;for(int i=1;i<n;i++)if(s[i]==s[i-1]){p=i;break;}
int start=p<n?p:n-1;
for(int i=start;i>=0;i--){for(char c=s[i]+1;c<='z';c++){s[i]=c;char prev=c;for(int j=i+1;j<n;j++){s[j]=prev=='a'?'b':'a';prev=s[j];}puts(s);return 0;}}
puts("-1");}
