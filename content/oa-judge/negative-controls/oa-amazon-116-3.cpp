#include <cstdio>
#include <cstring>
static char s[1000005];
int main(){scanf("%1000004s",s);int n=strlen(s),t=0;for(int i=1;i<n;i++)if(s[i]!=s[i-1])t++;printf("%d\n",t>1?t-1:0);}
