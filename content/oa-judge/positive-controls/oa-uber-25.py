from fractions import Fraction
def solve(d):
    result=[]
    for i in range(1,len(d),5):
        a,b,c,l,h=map(int,d[i:i+5]);x=max(Fraction(l),min(Fraction(h),Fraction(-b,2*a)))*1000000
        sign='-' if x<0 else '';x=abs(x);whole,remainder=divmod(x.numerator,x.denominator)
        whole+=2*remainder>x.denominator
        result.append(f'{sign}{whole//1000000}.{whole%1000000:06d}')
    return '\n'.join(result)
if __name__=='__main__':
    import sys
    print(solve(sys.stdin.read().split()))
