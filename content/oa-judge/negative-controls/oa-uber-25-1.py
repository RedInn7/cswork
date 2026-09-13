from decimal import Decimal,localcontext,ROUND_HALF_UP
def solve(d):
    answers=[]
    with localcontext() as ctx:
        ctx.prec=60
        for i in range(1,len(d),5):
            a,b,c,left,right=map(Decimal,d[i:i+5])
            def f(x):return (a*x+b)*x+c
            for _ in range(160):
                x=left+(right-left)/3;y=right-(right-left)/3
                if f(x)<f(y):right=y
                else:left=x
            point=Decimal(d[i+4]);answers.append(format(point.quantize(Decimal('0.000001'),rounding=ROUND_HALF_UP),'f'))
    return '\n'.join(answers)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
