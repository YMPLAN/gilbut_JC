(function(root){
 'use strict';
 const uid=()=>crypto.randomUUID();
 const clean=(s,n=160)=>typeof s==='string'?s.trim().slice(0,n):'';
 const normalize=s=>String(s).normalize('NFKC').replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\p{P}\p{Z}\p{S}\s]/gu,'').toLowerCase();
 function similarity(actual,targets){const a=Array.from(normalize(actual));if(!a.length)return null;return Math.max(...targets.map(t=>{const b=Array.from(normalize(t));let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return Math.round(100*Math.max(0,1-row[b.length]/Math.max(a.length,b.length)));}));}
 function blank(){return {format:'gilbut-local-classroom',version:1,schoolId:uid(),schoolName:'우리 학교',revision:0,students:[],records:[]};}
 const numeric=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
 function validate(data,lessonIds){
  if(!data||data.format!=='gilbut-local-classroom'||data.version!==1||!clean(data.schoolId,100)||!Array.isArray(data.students)||!Array.isArray(data.records)||data.students.length>3000||data.records.length>30000)throw Error('지원하는 학급 기록 파일이 아닙니다.');
  const students=data.students.map(s=>{if(!s||!clean(s.id,100)||!clean(s.name,60)||!clean(s.className,60)||!clean(s.number,20))throw Error('학생 명단 형식이 올바르지 않습니다.');return {id:clean(s.id,100),name:clean(s.name,60),className:clean(s.className,60),number:clean(s.number,20)};});
  const ids=new Set(students.map(s=>s.id));if(ids.size!==students.length)throw Error('중복된 학생 식별자가 있습니다.');
  const records=data.records.map(r=>{if(!r||!clean(r.id,100)||!ids.has(r.studentId)||!lessonIds.has(r.lessonId)||!clean(r.text,400)||!Number.isFinite(Date.parse(r.at))||typeof r.seconds!=='number'||!Number.isFinite(r.seconds)||r.seconds<.4||r.seconds>35||![1,2,3].includes(r.selfRating))throw Error('연습 기록 형식이 올바르지 않습니다.');
   if(r.match!==null&&r.match!==undefined&&!numeric(r.match))throw Error('문장 일치도 형식이 올바르지 않습니다.');
   let assessment=null;if(r.assessment){const a=r.assessment;if(![a.clarity,a.fluency,a.communication].every(v=>Number.isInteger(v)&&v>=1&&v<=4))throw Error('교사 평가 형식이 올바르지 않습니다.');assessment={clarity:a.clarity,fluency:a.fluency,communication:a.communication,note:clean(a.note,1000),at:clean(a.at,50)};}
   let ai=null;if(r.ai){if(!numeric(r.ai.score)||!clean(r.ai.feedback,2000))throw Error('AI 평가 형식이 올바르지 않습니다.');ai={score:r.ai.score,feedback:clean(r.ai.feedback,2000),transcript:clean(r.ai.transcript,1000),model:clean(r.ai.model,100),provider:'Gemini'};}
   let audio=r.audio||null;if(audio){if(typeof audio!=='string'||audio.length>6000000||!/^data:audio\/(webm|wav|mp4|ogg)(;codecs=[a-z0-9]+)?;base64,[A-Za-z0-9+/=]+$/.test(audio))throw Error('녹음 파일 형식 또는 크기가 올바르지 않습니다.');}
   return {id:clean(r.id,100),studentId:r.studentId,lessonId:r.lessonId,text:clean(r.text,400),at:r.at,seconds:r.seconds,selfRating:r.selfRating,match:numeric(r.match)?r.match:null,transcript:clean(r.transcript,1000),assessment,ai,audio};
  });if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('파일 안에 중복된 연습 기록이 있습니다.');
  return {format:data.format,version:1,schoolId:clean(data.schoolId,100),schoolName:clean(data.schoolName,100)||'우리 학교',revision:0,students,records};
 }
 function merge(current,incoming){
  if(current.schoolId!==incoming.schoolId)throw Error('다른 학급 공간의 파일입니다. 이 선생님 프로그램에서 만든 학생용 파일로 연습해야 합니다. 전체 복원은 별도의 복원 버튼을 이용하세요.');
  const byId=new Map(current.students.map(s=>[s.id,s]));for(const s of incoming.students){const old=byId.get(s.id);if(!old||old.className!==s.className||old.number!==s.number||old.name!==s.name)throw Error('명단과 학생 정보가 일치하지 않습니다. 파일의 학생 정보를 확인하세요.');}
  const existing=new Set(current.records.map(r=>r.id));const added=incoming.records.filter(r=>!existing.has(r.id)).map(r=>({...r,assessment:null}));
  return {...current,records:[...current.records,...added]};
 }
 function summary(students,records,lessons){
  const mean=a=>a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length*10)/10:null;
  return students.map(student=>{const rs=records.filter(r=>r.studentId===student.id),practiced=new Set(rs.map(r=>r.lessonId));const latest=new Map();for(const r of [...rs].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)))if(r.assessment)latest.set(r.lessonId,r.assessment);return {student,count:rs.length,coverage:practiced.size,total:lessons.length,match:mean(rs.filter(r=>numeric(r.match)).map(r=>r.match)),ai:mean(rs.filter(r=>r.ai).map(r=>r.ai.score)),teacher:mean([...latest.values()].map(a=>(a.clarity+a.fluency+a.communication)/3)),assessed:latest.size,last:rs.length?[...rs].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0].at:null};});
 }
 function enroll(state,input){
  const className=String(input.className||'').normalize('NFKC').trim().replace(/\s+/g,' '),name=String(input.name||'').normalize('NFC').trim().replace(/\s+/g,' '),raw=String(input.number||'').normalize('NFKC').trim();
  if(!className||className.length>60)throw Error('학급을 60자 이내로 입력해 주세요.');
  if(!/^\d{1,4}$/.test(raw)||Number(raw)<1)throw Error('번호는 1~9999 사이의 숫자로 입력해 주세요.');
  if(!name||name.length>60)throw Error('이름을 60자 이내로 입력해 주세요.');
  const number=String(Number(raw));
  const old=state.students.find(s=>s.className.normalize('NFKC').trim().replace(/\s+/g,' ')===className&&String(Number(s.number.normalize('NFKC')))===number);
  if(old){if(old.name.normalize('NFC').trim().replace(/\s+/g,' ')!==name)throw Error('이 학급·번호는 이미 등록되어 있습니다. 학급과 번호를 확인하거나 선생님께 알려 주세요.');return {state,student:old,created:false};}
  if(state.students.length>=3000)throw Error('등록 가능한 학생 수를 초과했습니다. 선생님께 알려 주세요.');
  const student={id:uid(),className,number,name};return {state:{...state,students:[...state.students,student]},student,created:true};
 }
 const api={uid,clean,normalize,similarity,blank,validate,merge,summary,enroll};root.GilbutCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

