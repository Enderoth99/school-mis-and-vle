"""Offline CP-SAT generation for the fictional integration fixture, not a hosted API."""
import sys,json,time,collections,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'tmp/timetable-solver-deps'))
from ortools.sat.python import cp_model
root=pathlib.Path(__file__).resolve().parent.parent
p=json.loads((root/'tmp/integrated-timetable-input.json').read_text(encoding='utf-8'))
m=cp_model.CpModel(); days=p['days']; periods=p['periods']; n=len(periods)
primary=[a for a in p['activities'] if a['subjectId']=='primary-curriculum']
activities=[a for a in p['activities'] if a not in primary]
x={}; owners={}; slots={}; teachers=collections.defaultdict(list); pupils=collections.defaultdict(list); rooms=collections.defaultdict(list)
room_by_id={r['id']:r for r in p['rooms']}; activity_by_id={a['id']:a for a in p['activities']}
def room_type(a):return room_by_id[a['roomIds'][0]]['type']
def allowed(a,d,k):
 if k+a['duration']>n:return False
 if any(periods[j-1]['end']!=periods[j]['start'] for j in range(k+1,k+a['duration'])):return False
 covered={days[d]['id']+'|'+periods[j]['id'] for j in range(k,k+a['duration'])}
 for t in p['teachers']:
  if t['id'] in a['teacherIds'] and covered.intersection(t.get('blocked',[])):return False
 for g in p['groups']:
  if g['id'] in a['groupIds'] and covered.intersection(g.get('blocked',[])):return False
 return True
for a in activities:
 aid=a['id']; options=[]
 eligible=a.get('eligibleTeacherIds',a['teacherIds'])
 for teacher in eligible:
  owners[aid,teacher]=m.new_bool_var('owner:'+aid+':'+teacher)
  m.add_hint(owners[aid,teacher],int(teacher in a['teacherIds']))
 m.add(sum(owners[aid,t] for t in eligible)==1)
 for d in range(len(days)):
  dayvars=[]
  for k in range(n):
   if not allowed(a,d,k):continue
   v=m.new_bool_var(f'{aid}:{d}:{k}');x[aid,d,k]=v;options.append(v);dayvars.append(v)
   for j in range(k,k+a['duration']):
    slot=d*n+j
    for t in eligible:
     assigned=m.new_bool_var(f'assigned:{aid}:{d}:{k}:{j}:{t}')
     m.add(assigned<=v);m.add(assigned<=owners[aid,t]);m.add(assigned>=v+owners[aid,t]-1)
     teachers[t,slot].append(assigned)
    for s in a['studentIds']:pupils[s,slot].append(v)
    rooms[room_type(a),slot].append(v)
  if a.get('spread'):m.add(sum(dayvars)<=1)
 m.add(sum(options)==a['weeklyCount'])
 for fixed in a.get('fixedSlots',[]):m.add(x[aid,next(i for i,d in enumerate(days) if d['id']==fixed['day']),next(i for i,r in enumerate(periods) if r['id']==fixed['period'])]==1)
for values in teachers.values():m.add(sum(values)<=1)
# Duplicate pupil constraint signatures are redundant (many pupils share all groups).
unique={tuple(sorted(v.index for v in values)):values for values in pupils.values()}
for values in unique.values():m.add(sum(values)<=1)
for b in p['optionBlocks']:
 first=b['activityIds'][0]
 for aid in b['activityIds'][1:]:
  for d in range(len(days)):
   for k in range(n):m.add(x[aid,d,k]==x[first,d,k])
primary_pe=[a for a in activities if a['subjectId']=='pe' and (not isinstance(a['year'],int) or a['year']<=6)]
for (kind,slot),values in rooms.items():
 capacity=sum(r['type']==kind for r in p['rooms'])
 if kind=='general':
  # Primary classrooms are occupied except while that form is in PE.
  d,k=divmod(slot,n); freed=[]
  for a in primary_pe:
   for start in range(max(0,k-a['duration']+1),k+1):
    if (a['id'],d,start) in x:freed.append(x[a['id'],d,start])
  m.add(sum(values)<=capacity-len(primary)+sum(freed))
 else:m.add(sum(values)<=capacity)
solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=240;solver.parameters.num_search_workers=8;solver.parameters.random_seed=26
print('CP-SAT model ready:',len(x),'placement variables;',len(unique),'unique pupil-slot constraints',flush=True)
status=solver.solve(m);print('Result:',solver.status_name(status),'seconds',solver.wall_time,flush=True)
if status not in (cp_model.OPTIMAL,cp_model.FEASIBLE):sys.exit(2)
chosen={a['id']:sorted((d,k) for (aid,d,k),v in x.items() if aid==a['id'] and solver.value(v)) for a in activities}
for a in activities:a['teacherIds']=[t for t in a.get('eligibleTeacherIds',a['teacherIds']) if solver.value(owners[a['id'],t])]
# Fill each primary form's own classroom outside its PE double.
for a in primary:
 pe=next(b for b in primary_pe if b['groupIds']==a['groupIds']);blocked={(d,k+j) for d,k in chosen[pe['id']] for j in range(pe['duration'])}
 chosen[a['id']]=[(d,k) for d in range(len(days)) for k in range(n) if (d,k) not in blocked]
busy=set();placements={}
for a in sorted(p['activities'],key=lambda a:(len(a['roomIds']),a['id'])):
 for ordinal,(d,k) in enumerate(chosen[a['id']],1):
  eligible=[r for r in a['roomIds'] if room_by_id[r]['capacity']>=len(a['studentIds'])]
  room=next((r for r in eligible if all((r,d,j) not in busy for j in range(k,k+a['duration']))),None)
  if room is None:raise RuntimeError('Room assignment failed for '+a['name'])
  for j in range(k,k+a['duration']):busy.add((room,d,j))
  placements[a['id']+'#'+str(ordinal)]={'day':days[d]['id'],'period':periods[k]['id'],'roomId':room,'locked':bool(a.get('fixedSlots'))}
p['placements']=placements;p['generationSummary']={'placed':len(placements),'total':len(placements),'complete':True,'solver':'Offline CP-SAT; independently validated before activation'}
(root/'tmp/integrated-timetable-solved.json').write_text(json.dumps(p),encoding='utf-8')
print('Wrote',len(placements),'placements',flush=True)
