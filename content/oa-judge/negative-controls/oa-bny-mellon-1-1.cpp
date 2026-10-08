#include <cstdio>
#include <cstdint>
using namespace std;
const long long MOD=1000000007;
struct Matrix{long long x[26][26]{};};
Matrix multiply(const Matrix&a,const Matrix&b){
 Matrix c;
 for(int i=0;i<26;i++)for(int k=0;k<26;k++)if(a.x[i][k])
  for(int j=0;j<26;j++)c.x[i][j]=(c.x[i][j]+a.x[i][k]*b.x[k][j])%MOD;
 return c;
}
int main(){
 long long counts[26]{};int ch;
 while((ch=getchar_unlocked())!=EOF && ch!='\n')if(ch>='a'&&ch<='z')counts[ch-'a']++;
 unsigned long long t=0;scanf("%llu",&t);
 t++;Matrix base,result;
 for(int i=0;i<26;i++)result.x[i][i]=1;
 for(int i=0;i<25;i++)base.x[i+1][i]=1;
 base.x[0][25]=1;base.x[1][25]=1;
 while(t){if(t&1)result=multiply(result,base);base=multiply(base,base);t>>=1;}
 long long answer=0;
 for(int i=0;i<26;i++)for(int j=0;j<26;j++)answer=(answer+result.x[i][j]*(counts[j]%MOD))%MOD;
 printf("%lld\n",answer);
}
