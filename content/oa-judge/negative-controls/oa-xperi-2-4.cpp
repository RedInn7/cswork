#include <cstdio>
int main(){unsigned long long a,b;scanf("%llu %llu",&a,&b);unsigned long long x=a,y=b;while(y){unsigned long long t=x%y;x=y;y=t;}printf("%llu\n",a/x+b/x-2);}
