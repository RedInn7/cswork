#include <cstdio>
#include <cstring>
int main(){static char s[2048];if(scanf("%2047s",s)!=1)return 0;int n=strlen(s),c=0;
for(int i=0;i+3<n;i++)if(s[i]!=s[i+1]&&s[i]!=s[i+2]&&s[i+1]!=s[i+2])c++;printf("%d\n",c);}
