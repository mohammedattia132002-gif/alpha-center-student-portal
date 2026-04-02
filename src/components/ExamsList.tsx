import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {
  cleanupRealtimeChannel,
  createRealtimeChannel,
  getRealtimeRecordId,
  removeListRowById,
  upsertListRow,
  type TableRealtimeHandlers,
} from '../lib/supabaseRealtime';
import {useAuth} from '../AuthContext';
import {loadStudentProfile} from '../lib/studentProfile';
import {ExamAttempt,PlatformExam,PlatformResult,Student} from '../types';
import {AlertTriangle,Award,CheckCircle,Clock,FileText,Play} from 'lucide-react';
import ExamView from './ExamView';
import {Spin,Empty} from './Attendance';
import {canStudentAccessExam} from '../lib/examAccess';

const ExamsList:React.FC=()=>{
  const {student}=useAuth();
  const [exams,setExams]=useState<PlatformExam[]>([]);
  const [results,setResults]=useState<PlatformResult[]>([]);
  const [attempts,setAttempts]=useState<ExamAttempt[]>([]);
  const [profileStudent,setProfileStudent]=useState<Student|null>(null);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<PlatformExam|null>(null);
  const [err,setErr]=useState<string|null>(null);
  const [openingExamId,setOpeningExamId]=useState<string|null>(null);

  const studentView=profileStudent||student;

  const applyExamRow = (row: PlatformExam) => {
    if (!studentView) return;
    const isActive = row.active !== false;
    const canAccess = canStudentAccessExam(studentView, row);
    setExams((previous) => {
      if (!isActive || !canAccess) {
        return removeListRowById(previous, row.id);
      }
      return upsertListRow(previous, row);
    });
  };

  const load=async()=>{
    if(!student) return;
    setLoading(true);
    try{
      const [profile,examsResponse,resultsResponse,attemptsResponse]=await Promise.all([
        loadStudentProfile(student.id),
        supabase.from('platform_exams').select('*').eq('active',true),
        supabase.from('platform_results').select('*').eq('student_id',student.id),
        supabase.from('exam_attempts').select('*').eq('student_id',student.id),
      ]);

      if(examsResponse.error) throw examsResponse.error;
      if(resultsResponse.error) throw resultsResponse.error;
      if(attemptsResponse.error) throw attemptsResponse.error;

      const effectiveStudent=profile||student;
      setProfileStudent(profile||null);

      if(examsResponse.data){
        setExams(examsResponse.data.filter((exam)=>canStudentAccessExam(effectiveStudent,exam)));
      }
      if(resultsResponse.data){
        setResults(resultsResponse.data);
      }
      if(attemptsResponse.data){
        setAttempts(attemptsResponse.data);
      }
      setErr(null);
    }catch(error){
      console.error('[ExamsList] Failed to load exams:', error);
      setErr('تعذر تحميل الامتحانات الآن. حاول مرة أخرى.');
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{load();},[student]);

  useEffect(()=>{
    if(!student) return;

    const refreshProfile=async()=>{
      try{
        const nextProfile=await loadStudentProfile(student.id);
        setProfileStudent(nextProfile||null);
      }catch(error){
        console.error('[ExamsList] Failed to refresh student profile:',error);
      }
    };

    const handlers: TableRealtimeHandlers[] = [
      ...(student.tenant_id ? [{
        table:'platform_exams',
        filter:`tenant_id=eq.${student.tenant_id}`,
        onInsert: ({ new: nextRow }) => {
          applyExamRow(nextRow as unknown as PlatformExam);
        },
        onUpdate: ({ new: nextRow }) => {
          applyExamRow(nextRow as unknown as PlatformExam);
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setExams((previous) => removeListRowById(previous, previousId));
        },
      }] : []),
      {
        table:'students',
        filter:`id=eq.${student.id}`,
        onInsert: () => {
          void refreshProfile();
        },
        onUpdate: () => {
          void refreshProfile();
        },
      },
      {
        table:'enrollments',
        filter:`student_id=eq.${student.id}`,
        onInsert: () => {
          void refreshProfile();
        },
        onUpdate: () => {
          void refreshProfile();
        },
        onDelete: () => {
          void refreshProfile();
        },
      },
      {
        table:'platform_results',
        filter:`student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          setResults((previous) => upsertListRow(previous, nextRow as unknown as PlatformResult));
        },
        onUpdate: ({ new: nextRow }) => {
          setResults((previous) => upsertListRow(previous, nextRow as unknown as PlatformResult));
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setResults((previous) => removeListRowById(previous, previousId));
        },
      },
      {
        table:'exam_attempts',
        filter:`student_id=eq.${student.id}`,
        onInsert: ({ new: nextRow }) => {
          setAttempts((previous) => upsertListRow(previous, nextRow as unknown as ExamAttempt));
        },
        onUpdate: ({ new: nextRow }) => {
          setAttempts((previous) => upsertListRow(previous, nextRow as unknown as ExamAttempt));
        },
        onDelete: ({ old: previousRow }) => {
          const previousId = getRealtimeRecordId(previousRow);
          if (!previousId) return;
          setAttempts((previous) => removeListRowById(previous, previousId));
        },
      },
    ];

    if(studentView?.group_id){
      handlers.push({
        table:'groups',
        filter:`id=eq.${studentView.group_id}`,
        onInsert: () => {
          void refreshProfile();
        },
        onUpdate: () => {
          void refreshProfile();
        },
        onDelete: () => {
          void refreshProfile();
        },
      });
    }

    const channel = createRealtimeChannel(`portal-exams-${student.id}`, handlers);
    return()=>{
      cleanupRealtimeChannel(channel);
    };
  },[student?.id,student?.tenant_id,studentView?.grade_level,studentView?.group_id,studentView?.group_name]);

  const start=async(exam:PlatformExam)=>{
    if(!student) return;
    setErr(null);
    setOpeningExamId(exam.id);
    try{
      const {data,error}=await supabase
        .from('exam_attempts')
        .select('*')
        .eq('student_id',student.id)
        .eq('exam_id',exam.id)
        .order('created_at',{ascending:false})
        .limit(1);

      if(error){
        setErr('تعذر فتح الامتحان الآن. حاول مرة أخرى.');
        return;
      }

      const latestAttempt=data?.[0] ?? null;
      if(latestAttempt?.status==='completed'){
        setErr('لقد أديت هذا الامتحان بالفعل.');
        return;
      }
      if(latestAttempt?.status==='terminated'){
        setErr('تم إنهاء هذا الامتحان بسبب مخالفة.');
        return;
      }

      setSelected(exam);
    }catch{
      setErr('تعذر فتح الامتحان الآن. حاول مرة أخرى.');
    }finally{
      setOpeningExamId(null);
    }
  };

  if(selected){
    return <ExamView exam={selected} onComplete={()=>{setSelected(null);load();}} onCancel={()=>setSelected(null)}/>;
  }

  if(loading){
    return <Spin text="جاري تحميل الامتحانات..."/>;
  }

  const completedCount=exams.filter((exam)=>{
    const result=results.find((item)=>item.exam_id===exam.id);
    const attempt=attempts.find((item)=>item.exam_id===exam.id);
    return Boolean(result || attempt?.status==='completed');
  }).length;
  const terminatedCount=exams.filter((exam)=>attempts.find((item)=>item.exam_id===exam.id)?.status==='terminated').length;
  const availableCount=Math.max(exams.length-completedCount-terminatedCount,0);

  return(
    <div className="page-stack a-up">
      {err && (
        <div className="alert-banner a-in">
          <AlertTriangle size={16}/>{err}
        </div>
      )}

      {exams.length>0 && (
        <div className="portal-metric-grid three exams-summary-grid">
          <div className="metric-card">
            <div className="metric-icon" style={{ background:'var(--violet-bg)' }}>
              <FileText size={16} color="var(--p2)" />
            </div>
            <div className="metric-value" style={{ color:'var(--p2)' }}>{exams.length}</div>
            <div className="metric-label">كل الامتحانات</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon" style={{ background:'var(--cyan-bg)' }}>
              <Play size={16} color="var(--cyan)" />
            </div>
            <div className="metric-value" style={{ color:'var(--cyan)' }}>{availableCount}</div>
            <div className="metric-label">متاح الآن</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon" style={{ background:'var(--green-bg)' }}>
              <CheckCircle size={16} color="var(--green)" />
            </div>
            <div className="metric-value" style={{ color:'var(--green)' }}>{completedCount}</div>
            <div className="metric-label">
              {terminatedCount ? `حلها/ملغاة ${terminatedCount}` : 'تم حلها'}
            </div>
          </div>
        </div>
      )}

      {exams.length===0 ? (
        <div className="content-card">
          <Empty icon={FileText} text="لا توجد امتحانات متاحة حاليًا"/>
        </div>
      ) : (
        <div
          className="exam-scroller"
          style={{
            padding:'2px 2px 10px',
          }}
        >
          {exams.map((exam,index)=>{
        const result=results.find((item)=>item.exam_id===exam.id);
        const attempt=attempts.find((item)=>item.exam_id===exam.id);
        const done=Boolean(result || attempt?.status==='completed');
        const killed=attempt?.status==='terminated';
        const resultMaxScore=Math.max(1,Number(result?.max_score || exam.max_score || 1));
        const percentage=result ? Math.round((result.score/resultMaxScore)*100) : 0;

        return(
          <div
            key={exam.id}
            className="content-card exam-card a-up"
            style={{
              animationDelay:`${index*0.06}s`,
            }}
          >
            <div className="content-card-hdr" style={{marginBottom:14}}>
              <div style={{width:36,height:36,borderRadius:12,flexShrink:0,background:done?'var(--green-bg)':killed?'var(--pink-bg)':'var(--violet-bg)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 8px 16px ${done?'rgba(16,185,129,.15)':killed?'rgba(244,63,94,.15)':'rgba(124,58,237,.15)'}`}}>
                <FileText size={18} color={done?'var(--green)':killed?'var(--pink)':'var(--violet)'}/>
              </div>
              <div>
                <div style={{fontSize:16,fontWeight:900,color:'var(--t1)',lineHeight:1.3,marginBottom:2}}>{exam.title}</div>
                {exam.description && <div style={{fontSize:11,color:'var(--t3)',fontWeight:600,lineHeight:1.4}}>{exam.description}</div>}
              </div>
            </div>

            <div className="exam-meta-row">
              <div className="exam-meta-pill">
                <Clock size={12}/>{exam.duration_minutes} دقيقة
              </div>
              <div className="exam-meta-pill">
                <Award size={12}/>{result?.max_score || exam.max_score} درجة
              </div>
            </div>

            {done ? (
              <div className="exam-state-panel done">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:result?8:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,color:'var(--green)',fontSize:13,fontWeight:700}}>
                    <CheckCircle size={15}/>تم الحل بنجاح
                  </div>
                  {result && (
                    <span className="exam-score-line" style={{textShadow:'0 0 10px rgba(0,229,160,.5)'}}>
                      {result.score}<span style={{fontSize:12,color:'var(--t3)',fontWeight:600}}>/{resultMaxScore}</span>
                    </span>
                  )}
                </div>
                {result && (
                  <>
                    <div className="prog">
                      <div className="prog-fill a-bar" style={{width:`${percentage}%`,background:'linear-gradient(90deg,#00A070,#00E5A0)',boxShadow:'0 0 8px rgba(0,229,160,.35)'}}/>
                    </div>
                    {(result.correct_answers_count!=null || result.wrong_answers_count!=null || result.unanswered_answers_count!=null) && (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginTop:10}}>
                        <div style={{padding:'8px 6px',borderRadius:12,background:'rgba(0,229,160,.08)',border:'1px solid rgba(0,229,160,.14)',textAlign:'center'}}>
                          <div style={{fontSize:16,fontWeight:900,color:'var(--green)'}}>{result.correct_answers_count ?? 0}</div>
                          <div style={{fontSize:11,fontWeight:700,color:'var(--t3)'}}>صحيحة</div>
                        </div>
                        <div style={{padding:'8px 6px',borderRadius:12,background:'rgba(255,77,139,.08)',border:'1px solid rgba(255,77,139,.14)',textAlign:'center'}}>
                          <div style={{fontSize:16,fontWeight:900,color:'var(--pink)'}}>{result.wrong_answers_count ?? 0}</div>
                          <div style={{fontSize:11,fontWeight:700,color:'var(--t3)'}}>خاطئة</div>
                        </div>
                        <div style={{padding:'8px 6px',borderRadius:12,background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.14)',textAlign:'center'}}>
                          <div style={{fontSize:16,fontWeight:900,color:'var(--p2)'}}>{result.unanswered_answers_count ?? 0}</div>
                          <div style={{fontSize:11,fontWeight:700,color:'var(--t3)'}}>غير مجابة</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : killed ? (
              <div className="exam-state-panel killed" style={{display:'flex',alignItems:'center',gap:8,color:'var(--pink)',fontSize:13,fontWeight:700}}>
                <AlertTriangle size={15}/>تم إنهاء الامتحان بسبب مخالفة
              </div>
            ) : (
              <button className="btn btn-violet btn-block" style={{padding:'14px',fontSize:15}} disabled={openingExamId===exam.id} onClick={()=>start(exam)}>
                <Play size={17}/>{openingExamId===exam.id?'جاري الفتح...':'ابدأ الامتحان الآن'}
              </button>
            )}
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
};

export default ExamsList;
