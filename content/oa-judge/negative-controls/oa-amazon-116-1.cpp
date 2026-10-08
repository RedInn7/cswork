#include <cstdio>
#include <cstring>
#include <algorithm>
static char s[1000005];
int main(){if(scanf("%1000004s",s)!=1)return 0;int n=strlen(s);int ones=0,zeros=0;for(int i=0;i<n;i++)(s[i]=='1'?ones:zeros)++;
int p1=0,p0=0,best=n;for(int k=0;k<=n;k++){int a=p1+(zeros-p0);int b=p0+(ones-p1);best=std::min(best,a);(void)b;if(k<n)(s[k]=='1'?p1:p0)++;}
printf("%d\n",best);}
