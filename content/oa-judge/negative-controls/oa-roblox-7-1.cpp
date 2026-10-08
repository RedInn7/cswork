#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int R,C;scanf("%d %d",&R,&C);vector<vector<int>>a(R,vector<int>(C));for(auto&row:a)for(auto&x:row)scanf("%d",&x);
int best=0;int dr[4]={-1,-1,1,1},dc[4]={-1,1,-1,1};
for(int r=0;r<R;r++)for(int c=0;c<C;c++)if(a[r][c]==1)for(int d=0;d<4;d++){int k=1,rr=r+dr[d],cc=c+dc[d];
 while(rr>=0&&rr<R&&cc>=0&&cc<C&&a[rr][cc]==(k%2?2:0)){k++;rr+=dr[d];cc+=dc[d];}best=max(best,k);}
printf("%d\n",best);}
