def solve(data):
    s=data[0];ones=0;answer=0;previous='0'
    for char in s:
        if char=='1':ones+=1
        else:
            answer+=ones
            if previous=='1':answer+=ones
        previous=char
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
