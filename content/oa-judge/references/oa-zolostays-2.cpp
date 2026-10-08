#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;scanf("%d",&n);vector<int> h(n);for(int &x:h)scanf("%d",&x);
int left=0,right=n-1,leftMax=0,rightMax=0;long long answer=0;
while(left<=right){if(leftMax<=rightMax){leftMax=max(leftMax,h[left]);answer+=leftMax-h[left];++left;}else{rightMax=max(rightMax,h[right]);answer+=rightMax-h[right];--right;}}
printf("%lld\n",answer);}
