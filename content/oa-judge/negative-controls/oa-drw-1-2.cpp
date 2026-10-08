#include <cstdio>
#include <cstring>
#include <vector>
#include <string>
#include <iostream>
using namespace std;
int main(){ios::sync_with_stdio(false);
int sx[7][4]={{0,1,0,1},{1,2,0,1},{0,1,1,2},{1,0,1,2},{0,1,2,3},{0,1,0,0},{0,1,1,1}};
int sy[7][4]={{0,0,1,1},{0,0,1,1},{0,0,1,1},{0,1,1,1},{0,0,0,0},{0,0,1,2},{0,0,1,2}};
const char*names="QZSTILJ";string line,out;
while(getline(cin,line)){if(!line.empty()&&line.back()=='\r')line.pop_back();if(line.empty())continue;
 vector<int>rows;size_t p=0;
 while(p<line.size()){int t=strchr(names,line[p])-names;int c=line[p+1]-'0';p+=2;if(p<line.size()&&line[p]==',')p++;
  int H=rows.size();int y=0;
  for(;;y++){bool ok=true;for(int k=0;k<4;k++){int r=y+sy[t][k];if(r<H&&(rows[r]>>(c+sx[t][k])&1))ok=false;}if(ok)break;}
  for(int k=0;k<4;k++){int r=y+sy[t][k];while((int)rows.size()<=r)rows.push_back(0);rows[r]|=1<<(c+sx[t][k]);}
  vector<int>keep;for(int r:rows)if(r!=1023)keep.push_back(r);rows=keep;
  while(!rows.empty()&&rows.back()==0)rows.pop_back();}
 out+=to_string(rows.size());out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
