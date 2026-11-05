"""Schedule primary core/specialist lessons while retaining the validated secondary week."""
import json,sys,pathlib,collections
root=pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'tmp/timetable-solver-deps'))
from ortools.sat.python import cp_model
p=json.loads((root/'tmp/primary-specialists-input.json').read_text(encoding='utf8'))
m=cp_model.CpModel();days=p['days'];periods=p['periods'];n=len(periods)
primary=[a for a in p['activities'] if a.get('primaryCore') or a.get('primarySpecialist')]
by_id={a['id']:a for a in p['activities']};x={};room_x={}
teacher_slots=collections.defaultdict(list);group_slots=collections.defaultdict(list);room_slots=collections.defaultdict(list)
fixed_rooms=collections.Counter()
for lesson_id,pos in p['placements'].items():
 a=by_id[lesson_id.split('#')[0]];d=next(i for i,r in enumerate(days) if r['id']==pos['day']);k=next(i for i,r in enumerate(periods) if r['id']==pos['period'])
 for j in range(k,k+a['duration']):fixed_rooms[pos['roomId'],d,j]+=1
for a in primary:
 all_vars=[]
 for d in range(5):
  daily=[]
  for k in range(n-a['duration']+1):
   if any(periods[j-1]['end']!=periods[j]['start'] for j in range(k+1,k+a['duration'])):continue
   covered={days[d]['id']+'|'+periods[j]['id'] for j in range(k,k+a['duration'])}
   if any(covered.intersection(t.get('blocked',[])) for t in p['teachers'] if t['id'] in a['teacherIds']):continue
   v=m.new_bool_var(f"{a['id']}:{d}:{k}");x[a['id'],d,k]=v;all_vars.append(v);daily.append(v)
   for j in range(k,k+a['duration']):
    teacher_slots[a['teacherIds'][0],d,j].append(v);group_slots[a['groupIds'][0],d,j].append(v)
   eligible=[]
   for room in a['roomIds']:
    if any(fixed_rooms[room,d,j] for j in range(k,k+a['duration'])):continue
    r=m.new_bool_var(f"room:{a['id']}:{d}:{k}:{room}");room_x[a['id'],d,k,room]=r;eligible.append(r)
    for j in range(k,k+a['duration']):room_slots[room,d,j].append(r)
   m.add(sum(eligible)==v)
  if a.get('spread'):m.add(sum(daily)<=1)
  elif a['subjectId'] in ['english','mathematics']:m.add(sum(daily)<=2)
  elif a['subjectId']=='science':m.add(sum(daily)<=1)
  elif a['subjectId'] in ['humanities','pshe']:m.add(sum(daily)<=1)
 m.add(sum(all_vars)==a['weeklyCount'])
for values in teacher_slots.values():m.add(sum(values)<=1)
for values in room_slots.values():m.add(sum(values)<=1)
for values in group_slots.values():m.add(sum(values)==1)
solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=180;solver.parameters.num_search_workers=8;solver.parameters.random_seed=27
print('Scheduling primary lessons:',len(x),'placements;',len(primary),'activities',flush=True)
status=solver.solve(m);print(solver.status_name(status),solver.wall_time,flush=True)
if status not in (cp_model.OPTIMAL,cp_model.FEASIBLE):sys.exit(2)
for a in primary:
 starts=sorted((d,k) for (aid,d,k),v in x.items() if aid==a['id'] and solver.value(v))
 for ordinal,(d,k) in enumerate(starts,1):
  room=next(r for r in a['roomIds'] if (a['id'],d,k,r) in room_x and solver.value(room_x[a['id'],d,k,r]))
  p['placements'][a['id']+'#'+str(ordinal)]={'day':days[d]['id'],'period':periods[k]['id'],'roomId':room,'locked':False}
p['generationSummary']={'placed':len(p['placements']),'total':sum(a['weeklyCount'] for a in p['activities']),'solver':'Offline CP-SAT; independently validated before activation'}
(root/'tmp/primary-specialists-solved.json').write_text(json.dumps(p),encoding='utf8')
print('Wrote',len(p['placements']),'lesson cards',flush=True)
