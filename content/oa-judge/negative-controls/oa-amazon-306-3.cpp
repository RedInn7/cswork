#include <cstdio>
#include <cstring>
static char s[1000005];
int main(){if(scanf("%1000004s",s)!=1)return 0;int n=strlen(s),m=0;for(int i=0;i<n/2;i++)if(s[i]!=s[n-1-i])m++;
if(m%2==0)printf("%d\n",m/2);else printf("%d\n",(m+1)/2);}
