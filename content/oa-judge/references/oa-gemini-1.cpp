#include <cstdio>
#include <cstdint>
#include <vector>
#include <algorithm>
using namespace std;
uint32_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();uint32_t x=0;while(c>32&&c!=EOF){x=x*10+uint32_t(c-'0');c=getchar_unlocked();}return x;}
struct Node{uint32_t height,width,cost;};
static_assert(sizeof(Node)==12);
int main(){uint32_t n=readNumber();vector<Node> st;st.reserve(size_t(n)+1);st.push_back({0,0,0});
auto append=[&](uint32_t h,uint32_t width){uint32_t cost=0;
while(st.back().height>h){Node node=st.back();st.pop_back();uint32_t base=max(h,st.back().height);
uint32_t value=uint32_t(min<uint64_t>(node.width,uint64_t(node.cost)+node.height-base));
if(st.back().height>=h){st.back().width+=node.width;st.back().cost+=value;}else{width+=node.width;cost+=value;}}
if(st.back().height==h){st.back().width+=width;st.back().cost+=cost;}else st.push_back({h,width,cost});};
for(uint32_t i=0;i<n;i++)append(readNumber(),1);append(0,0);printf("%u\n",st.front().cost);}
