export const hasScore=r=>r.assessment_status==='assessed'&&r.ai_score!==''&&r.ai_score!==null&&Number.isFinite(Number(r.ai_score));
export const mean=values=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:null;
export function summarize(records,students,lessons,{className='',studentId='',from='',to=''}={}) {
  const roster=students.filter(s=>(!className||s.className===className)&&(!studentId||s.id===studentId));
  const ids=new Set(roster.map(s=>s.id));
  const localDay=r=>new Date(r.created_at).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
  const rows=records.filter(r=>ids.has(String(r.student_id))&&(!from||localDay(r)>=from)&&(!to||localDay(r)<=to)).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
  const lessonIds=new Set(lessons.map(l=>String(l.id)));
  const perStudent=roster.map(student=>{const rs=rows.filter(r=>String(r.student_id)===student.id);const count=new Map();for(const r of rs)if(lessonIds.has(String(r.lesson_id)))count.set(String(r.lesson_id),(count.get(String(r.lesson_id))||0)+1);
    const groups=new Map();for(const r of rs.filter(hasScore)){const key=[r.lesson_id,r.reference_text,r.model,r.rubric_version].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
    const deltas=[...groups.values()].filter(g=>g.length>=2).map(g=>Number(g.at(-1).ai_score)-Number(g[0].ai_score));
    return {...student,attempts:rs.length,assessed:rs.filter(hasScore).length,completed:[...count.values()].filter(n=>n>=3).length,totalLessons:lessons.length,average:mean(rs.filter(hasScore).map(r=>Number(r.ai_score))),selfRating:mean(rs.map(r=>Number(r.self_rating)).filter(n=>[1,2,3].includes(n))),change:mean(deltas),last:rs.at(-1)?.created_at||null};});
  const byLesson=lessons.map(l=>{const rs=rows.filter(r=>String(r.lesson_id)===String(l.id));return {...l,attempts:rs.length,assessed:rs.filter(hasScore).length,average:mean(rs.filter(hasScore).map(r=>Number(r.ai_score))),selfRating:mean(rs.map(r=>Number(r.self_rating)).filter(n=>[1,2,3].includes(n)))};});
  const days=new Map();for(const r of rows){const d=localDay(r);if(!days.has(d))days.set(d,[]);days.get(d).push(r);}
  return {rows,students:perStudent,lessons:byLesson,participating:perStudent.filter(s=>s.attempts>0).length,totalStudents:roster.length,attempts:rows.length,assessed:rows.filter(hasScore).length,average:mean(rows.filter(hasScore).map(r=>Number(r.ai_score))),trend:[...days].map(([date,rs])=>({date,count:rs.length,average:mean(rs.filter(hasScore).map(r=>Number(r.ai_score)))}))};
}
