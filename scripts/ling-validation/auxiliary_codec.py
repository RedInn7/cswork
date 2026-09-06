"""Fixed adapters for the reviewed MountainArray and Interval reference APIs."""
class MountainArray:
    def __init__(self, values):
        if type(values) is not list or not 3<=len(values)<=10000 or not all(type(v) is int and 0<=v<=10**9 for v in values):
            raise ValueError('Invalid mountain storage')
        peak=values.index(max(values))
        if not 0<peak<len(values)-1 or any(a>=b for a,b in zip(values[:peak],values[1:peak+1])) or any(a<=b for a,b in zip(values[peak:],values[peak+1:])):raise ValueError('Invalid mountain shape')
        self._values=tuple(values)
        self.calls=0
    def get(self, index):
        if type(index) is not int or not 0<=index<len(self._values):
            raise ValueError('Invalid mountain index')
        self.calls+=1
        if self.calls>100:raise ValueError('MountainArray get budget exceeded')
        return self._values[index]
    def length(self):return len(self._values)

class Interval:
    def __init__(self,start=None,end=None):
        self.start=start
        self.end=end

def prepare_args(problem_id,args):
    if problem_id==1095:
        if type(args)is not list or len(args)!=2 or type(args[0])is not int or not 0<=args[0]<=10**9:raise ValueError('Invalid mountain arguments')
        return [args[0],MountainArray(args[1])]
    if problem_id==759:
        if type(args)is not list or len(args)!=1 or type(args[0])is not list or not 1<=len(args[0])<=50:raise ValueError('Invalid interval arguments')
        schedules=[]
        for employee in args[0]:
            if type(employee)is not list or not 1<=len(employee)<=50:raise ValueError('Invalid employee schedule')
            row=[]
            for pair in employee:
                if type(pair)is not list or len(pair)!=2 or any(type(v)is not int or not 0<=v<=10**8 for v in pair) or pair[0]>=pair[1]:raise ValueError('Invalid interval')
                row.append(Interval(*pair))
            if any(a.end>b.start for a,b in zip(row,row[1:])):raise ValueError('Unsorted or overlapping employee intervals')
            schedules.append(row)
        return [schedules]
    raise ValueError('Unknown auxiliary codec')

def prepare_result(problem_id,result):
    if problem_id==1095:
        if type(result)is not int:raise ValueError('Invalid mountain result')
        return result
    if problem_id==759:
        if type(result)is not list or len(result)>2500:raise ValueError('Invalid interval result')
        answer=[]
        for interval in result:
            if not isinstance(interval,Interval) or type(interval.start)is not int or type(interval.end)is not int or not 0<=interval.start<interval.end<=10**8:raise ValueError('Invalid returned interval')
            answer.append([interval.start,interval.end])
        return answer
    raise ValueError('Unknown auxiliary codec')
