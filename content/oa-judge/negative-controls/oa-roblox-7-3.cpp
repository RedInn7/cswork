#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int R,C;if(scanf("%d %d",&R,&C)!=2)return 0;vector<int>a(R*C);for(auto&x:a)scanf("%d",&x);
int best=0;int dr[4]={-1,-1,1,1},dc[4]={-1,1,-1,1};
vector<int>len2(R*C),len0(R*C); // length of a valid tail starting here with expected value 2 / 0, reaching the border; 0 if invalid
for(int d=0;d<4;d++){
 int r0=dr[d]<0?0:R-1,r1=dr[d]<0?R:-1,rs=dr[d]<0?1:-1;int c0=dc[d]<0?0:C-1,c1=dc[d]<0?C:-1,cs=dc[d]<0?1:-1;
 for(int r=r0;r!=r1;r+=rs)for(int c=c0;c!=c1;c+=cs){int nr=r+dr[d],nc=c+dc[d];bool out=nr<0||nr>=R||nc<0||nc>=C;int i=r*C+c,j=out?-1:nr*C+nc;
  len2[i]=a[i]!=2?0:out?1:(len0[j]?len0[j]+1:0);
  len0[i]=a[i]!=0?0:out?1:(len2[j]?len2[j]+1:0);
  if(a[i]==1){int L=out?1:(len0[j]?len0[j]+1:0);best=max(best,L);}}}
printf("%d\n",best);}
