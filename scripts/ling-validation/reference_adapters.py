"""Authored fixed adapters for LeetCode's in-place result conventions."""
ADAPTERS=('return','arg0','prefix-arg0','matrix-arg0','characters-arg0')

def adapt_result(adapter,result,args):
    if adapter not in ADAPTERS:raise ValueError('Unknown reference result adapter')
    if adapter=='return':return result
    if not isinstance(args,list) or not args or not isinstance(args[0],list):
        raise ValueError('In-place adapter requires a first array argument')
    values=args[0]
    if adapter=='prefix-arg0':
        if type(result)is not int or not 0<=result<=len(values):
            raise ValueError('Invalid in-place prefix length')
        return values[:result]
    if adapter=='arg0':return values
    if adapter=='characters-arg0':
        if any(type(v)is not str or len(v)!=1 for v in values):
            raise ValueError('Expected character array')
        return ''.join(values)
    if any(type(row)is not list for row in values) or len({len(row) for row in values})>1:
        raise ValueError('Expected rectangular matrix')
    return [value for row in values for value in row]
