import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {useAuth} from '../AuthContext';
import {PlatformChoice,PlatformExam,PlatformQuestion} from '../types';
import {calculateExamSummary,getQuestionInputMode, type ExamSummary} from '../lib/examScoring';
import {AlertCircle,Check,CheckCircle,ChevronLeft,ChevronRight,Clock,Send,X} from 'lucide-react';

interface P{exam:PlatformExam;onComplete:()=>void;onCancel:()=>void}
interface QC extends PlatformQuestion{choices:PlatformChoice[]}
interface ExamAttemptRow{
  id:string;
  status:string;
  warnings_count?:number|null;
  started_at?:string|null;
  created_at?:string|null;
}
interface ExamAnswerRow{
  question_id:string;
  selected_choice_id?:string|null;
  selected_answer_text?:string|null;
}

type SupabaseErrorLike={
  code?:string;
  message?:string;
};

const unsupportedColumnsByTable=new Map<string,Set<string>>();

const getUnsupportedColumns=(table:string)=>{
  const unsupportedColumns=unsupportedColumnsByTable.get(table);
  return unsupportedColumns ? new Set(unsupportedColumns) : new Set<string>();
};

const rememberUnsupportedColumn=(table:string,column:string)=>{
  const unsupportedColumns=getUnsupportedColumns(table);
  unsupportedColumns.add(column);
  unsupportedColumnsByTable.set(table,unsupportedColumns);
};

const sanitizePayloadForTable=(table:string,payload:Record<string,unknown>)=>{
  const candidate={...payload};
  getUnsupportedColumns(table).forEach((column)=>{
    delete candidate[column];
  });
  return candidate;
};

const getErrorText=(error:unknown,fallback:string)=>{
  if(error && typeof error==='object' && 'message' in error){
    const message=error.message;
    if(typeof message==='string' && message.trim()) return message;
  }
  return fallback;
};

const getExamInitErrorMessage=(error:unknown)=>{
  const message=getErrorText(error,'تعذر تجهيز الامتحان الآن. حاول مرة أخرى.');
  if(message.includes('row-level security')){
    return 'تعذر بدء الامتحان الآن بسبب إعدادات الصلاحيات على الخادم.';
  }
  if(message.includes('duplicate key')){
    return 'تم العثور على محاولة سابقة لهذا الامتحان. أعد المحاولة وسيتم فتح أحدث محاولة متاحة.';
  }
  return message;
};

const getRemainingSeconds=(startedAt:string|undefined|null,durationMinutes:number)=>{
  const totalSeconds=Math.max(0,durationMinutes*60);
  if(!startedAt) return totalSeconds;
  const startedAtMs=new Date(startedAt).getTime();
  if(Number.isNaN(startedAtMs)) return totalSeconds;
  const elapsedSeconds=Math.max(0,Math.floor((Date.now()-startedAtMs)/1000));
  return Math.max(0,totalSeconds-elapsedSeconds);
};

const getLatestAttempt=(attempts:ExamAttemptRow[]|null|undefined)=>{
  if(!attempts?.length) return null;
  return attempts[0] ?? null;
};

const extractMissingColumnName=(error:SupabaseErrorLike)=>{
  const message=String(error.message || '');
  const schemaMatch=message.match(/Could not find the ['"]?([A-Za-z0-9_]+)['"]? column/i);
  if(schemaMatch?.[1]) return schemaMatch[1];
  const genericMatch=message.match(/column\s+["'`]?([A-Za-z0-9_]+)["'`]?/i);
  if(genericMatch?.[1] && genericMatch[1].toLowerCase()!=='of') return genericMatch[1];
  return null;
};

const insertWithSchemaFallback=async(table:string,payload:Record<string,unknown>)=>{
  const candidate=sanitizePayloadForTable(table,payload);

  for(let attempt=0;attempt<Object.keys(payload).length;attempt+=1){
    const {error}=await supabase.from(table).insert(candidate);
    if(!error) return;

    if(error.code!=='42703' && error.code!=='PGRST204'){
      throw error;
    }

    const missingColumn=extractMissingColumnName(error);
    if(!missingColumn || !(missingColumn in candidate)){
      throw error;
    }

    rememberUnsupportedColumn(table,missingColumn);
    delete candidate[missingColumn];
  }

  throw new Error(`insert_with_schema_fallback_failed:${table}`);
};

const updateWithSchemaFallback=async(
  table:string,
  matcher:{column:string;value:string},
  payload:Record<string,unknown>,
)=>{
  const candidate=sanitizePayloadForTable(table,payload);

  for(let attempt=0;attempt<Object.keys(payload).length;attempt+=1){
    const {error}=await supabase
      .from(table)
      .update(candidate)
      .eq(matcher.column,matcher.value);

    if(!error) return;

    if(error.code!=='42703' && error.code!=='PGRST204'){
      throw error;
    }

    const missingColumn=extractMissingColumnName(error);
    if(!missingColumn || !(missingColumn in candidate)){
      throw error;
    }

    rememberUnsupportedColumn(table,missingColumn);
    delete candidate[missingColumn];
  }

  throw new Error(`update_with_schema_fallback_failed:${table}`);
};

const PLATFORM_EXAM_ASSETS_BUCKET=String(
  import.meta.env.VITE_PLATFORM_EXAM_ASSETS_BUCKET ||
  import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ||
  'secure-files',
).trim() || 'secure-files';

const QUESTION_IMAGE_SIGNED_URL_TTL_SECONDS=60*60;

const isDirectImageUrl=(value:string)=>{
  const normalized=value.trim().toLowerCase();
  return normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('data:')
    || normalized.startsWith('blob:')
    || normalized.startsWith('/');
};

const extractQuestionIdFromStorageName=(value:string)=>{
  const match=value.match(/page-\d+-([a-f0-9-]+)\.[a-z0-9]+$/i);
  return match?.[1] ?? null;
};

const resolveQuestionImageUrls=async(exam:PlatformExam,questions:PlatformQuestion[]):Promise<PlatformQuestion[]>=>{
  const storagePathByQuestionId=new Map<string,string>();

  questions.forEach((question)=>{
    const storagePath=String(question.image_storage_path || '').trim();
    const imageUrl=String(question.image_url || '').trim();
    if(storagePath){
      storagePathByQuestionId.set(question.id,storagePath);
      return;
    }
    if(imageUrl && !isDirectImageUrl(imageUrl)){
      storagePathByQuestionId.set(question.id,imageUrl);
    }
  });

  const unresolvedQuestions=questions.filter((question)=>{
    const imageUrl=String(question.image_url || '').trim();
    return !storagePathByQuestionId.has(question.id) && !isDirectImageUrl(imageUrl);
  });

  if(unresolvedQuestions.length && exam.tenant_id){
    const prefix=`platform-exams/${String(exam.tenant_id).trim()}/${exam.id}/questions`;
    const {data:listData,error:listError}=await supabase
      .storage
      .from(PLATFORM_EXAM_ASSETS_BUCKET)
      .list(prefix,{limit:Math.max(unresolvedQuestions.length,50),sortBy:{column:'name',order:'asc'}});

    if(listError){
      console.error('[ExamView] failed to list question images from storage:',listError);
    }else{
      (listData ?? []).forEach((file)=>{
        const name=String(file.name || '').trim();
        const questionId=extractQuestionIdFromStorageName(name);
        if(questionId){
          storagePathByQuestionId.set(questionId,`${prefix}/${name}`);
        }
      });
    }
  }

  const pending=questions
    .map((question)=>{
      const imageUrl=String(question.image_url || '').trim();
      return {
        storagePath:storagePathByQuestionId.get(question.id) || '',
        imageUrl:isDirectImageUrl(imageUrl) ? imageUrl : '',
      };
    })
    .filter((entry)=>entry.storagePath && !entry.imageUrl);

  if(!pending.length) return questions;

  const {data,error}=await supabase
    .storage
    .from(PLATFORM_EXAM_ASSETS_BUCKET)
    .createSignedUrls(
      pending.map((entry)=>entry.storagePath),
      QUESTION_IMAGE_SIGNED_URL_TTL_SECONDS,
    );

  if(error){
    console.error('[ExamView] failed to create signed question image URLs:',error);
    return questions;
  }

  const signedUrlByPath=new Map<string,string>();
  (data ?? []).forEach((entry,index)=>{
    const storagePath=pending[index]?.storagePath;
    const signedUrl=typeof entry?.signedUrl==='string' ? entry.signedUrl.trim() : '';
    if(storagePath && signedUrl){
      signedUrlByPath.set(storagePath,signedUrl);
    }
  });

  return questions.map((question)=>{
    const imageUrl=String(question.image_url || '').trim();
    const storagePath=storagePathByQuestionId.get(question.id) || String(question.image_storage_path || '').trim();
    if(isDirectImageUrl(imageUrl) || !storagePath){
      return {
        ...question,
        image_storage_path:storagePath || question.image_storage_path || null,
      };
    }
    return {
      ...question,
      image_storage_path:storagePath,
      image_url:signedUrlByPath.get(storagePath) || undefined,
    };
  });
};

const ExamView:React.FC<P>=({exam,onComplete,onCancel})=>{
  const {student}=useAuth();
  const [qs,setQs]=useState<QC[]>([]);
  const [qi,setQi]=useState(0);
  const [ans,setAns]=useState<Record<string,string>>({});
  const [textAns,setTextAns]=useState<Record<string,string>>({});
  const [t,setT]=useState(exam.duration_minutes*60);
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [scr,setScr]=useState(0);
  const [resultSummary,setResultSummary]=useState<ExamSummary|null>(null);
  const [aid,setAid]=useState<string|null>(null);
  const [warn,setWarn]=useState(0);
  const [showW,setShowW]=useState(false);
  const [killed,setKilled]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState<string|null>(null);
  const [toast,setToast]=useState<{msg:string;type:'w'|'d'}|null>(null);
  const [n5,setN5]=useState(false);
  const [n1,setN1]=useState(false);
  const [imgErr,setImgErr]=useState<Record<string,boolean>>({});
  const [retryKey,setRetryKey]=useState(0);
  const wR=useRef(0);
  const subR=useRef(false);
  const initInFlightRef=useRef(false);

  useEffect(()=>{
    const init=async()=>{
      if(initInFlightRef.current) return;
      initInFlightRef.current=true;

      setLoading(true);
      setLoadError(null);
      setDone(false);
      setKilled(false);
      setShowW(false);
      setWarn(0);
      setQi(0);
      setQs([]);
      setAns({});
      setTextAns({});
      setAid(null);
      setScr(0);
      setResultSummary(null);
      setBusy(false);
      setToast(null);
      setN5(false);
      setN1(false);
      setImgErr({});
      wR.current=0;

      if(!student){
        setLoading(false);
        setLoadError('تعذر تحميل بيانات الطالب. أعد تسجيل الدخول ثم حاول مرة أخرى.');
        initInFlightRef.current=false;
        return;
      }

      try{
        let attemptId='';

        const {data:existingAttempts,error:existingAttemptError}=await supabase
          .from('exam_attempts')
          .select('*')
          .eq('student_id',student.id)
          .eq('exam_id',exam.id)
          .order('created_at',{ascending:false})
          .limit(1);

        if(existingAttemptError) throw existingAttemptError;

        const existingAttempt=getLatestAttempt(existingAttempts as ExamAttemptRow[]|undefined);
        if(existingAttempt){
          if(['completed','terminated','timed_out'].includes(existingAttempt.status)){
            onCancel();
            return;
          }
          attemptId=existingAttempt.id;
          setAid(attemptId);
          const warningsCount=existingAttempt.warnings_count||0;
          setWarn(warningsCount);
          wR.current=warningsCount;
          setT(getRemainingSeconds(existingAttempt.started_at,exam.duration_minutes));
        }else{
          setT(exam.duration_minutes*60);
          const {data:newAttempt,error:newAttemptError}=await supabase
            .from('exam_attempts')
            .insert({
              student_id:student.id,
              exam_id:exam.id,
              tenant_id:student.tenant_id,
              status:'in_progress',
              warnings_count:0,
              started_at:new Date().toISOString(),
            })
            .select()
            .single<ExamAttemptRow>();

          if(newAttemptError || !newAttempt){
            const duplicateText=getErrorText(newAttemptError,'');
            if(duplicateText.includes('duplicate key')){
              const {data:fallbackAttempts,error:fallbackError}=await supabase
                .from('exam_attempts')
                .select('*')
                .eq('student_id',student.id)
                .eq('exam_id',exam.id)
                .order('created_at',{ascending:false})
                .limit(1);
              if(fallbackError) throw fallbackError;
              const fallbackAttempt=getLatestAttempt(fallbackAttempts as ExamAttemptRow[]|undefined);
              if(!fallbackAttempt) throw newAttemptError;
              attemptId=fallbackAttempt.id;
              setAid(attemptId);
              const warningsCount=fallbackAttempt.warnings_count||0;
              setWarn(warningsCount);
              wR.current=warningsCount;
              setT(getRemainingSeconds(fallbackAttempt.started_at,exam.duration_minutes));
            }else{
              throw newAttemptError ?? new Error('تعذر إنشاء محاولة الامتحان.');
            }
          }else{
            attemptId=newAttempt.id;
            setAid(attemptId);
          }
        }

        const {data:questions,error:questionsError}=await supabase
          .from('platform_questions')
          .select('*')
          .eq('exam_id',exam.id);
        if(questionsError) throw questionsError;

        if(questions?.length){
          const resolvedQuestions=await resolveQuestionImageUrls(exam,questions as PlatformQuestion[]);
          const questionIds=resolvedQuestions.map((question)=>question.id);
          const {data:choices,error:choicesError}=await supabase
            .from('platform_choices')
            .select('*')
            .in('question_id',questionIds);
          if(choicesError) throw choicesError;

          setQs(
            [...resolvedQuestions]
              .sort(()=>Math.random()-0.5)
              .map((question)=>({
                ...question,
                choices:(choices??[])
                  .filter((choice)=>choice.question_id===question.id)
                  .sort(()=>Math.random()-0.5),
              })),
          );
        }

        const {data:existingAnswers,error:existingAnswersError}=await supabase
          .from('exam_answers')
          .select('*')
          .eq('attempt_id',attemptId);
        if(existingAnswersError) throw existingAnswersError;

        if(existingAnswers){
          const mappedAnswers:Record<string,string>={};
          const mappedTextAnswers:Record<string,string>={};
          existingAnswers.forEach((answer:ExamAnswerRow)=>{
            if(answer.selected_choice_id){
              mappedAnswers[answer.question_id]=answer.selected_choice_id;
            }
            if(answer.selected_answer_text){
              mappedTextAnswers[answer.question_id]=String(answer.selected_answer_text);
            }
          });
          setAns(mappedAnswers);
          setTextAns(mappedTextAnswers);
        }
      }catch(error){
        console.error('[ExamView] initialization failed:',error);
        setLoadError(getExamInitErrorMessage(error));
      }finally{
        initInFlightRef.current=false;
        setLoading(false);
      }
    };

    init();
  },[exam.duration_minutes,exam.id,onCancel,retryKey,student]);

  useEffect(()=>{
    if(done||killed||!aid) return;
    const handleFocusViolation=async()=>{
      if(!document.hidden) return;
      const previousWarnings=wR.current;
      const nextWarnings=previousWarnings+1;
      wR.current=nextWarnings;
      setWarn(nextWarnings);
      try{
        const {error:warningUpdateError}=await supabase
          .from('exam_attempts')
          .update({warnings_count:nextWarnings})
          .eq('id',aid);
        if(warningUpdateError) throw warningUpdateError;

        if(nextWarnings>=3){
          await terminate();
        }else{
          setShowW(true);
        }
      }catch(error){
        wR.current=previousWarnings;
        setWarn(previousWarnings);
        console.error('[ExamView] warning update failed:',error);
        setToast({msg:'تعذر تحديث التحذير الآن. حاول العودة إلى الامتحان مرة أخرى.',type:'d'});
      }
    };
    document.addEventListener('visibilitychange',handleFocusViolation);
    window.addEventListener('blur',handleFocusViolation);
    return()=>{
      document.removeEventListener('visibilitychange',handleFocusViolation);
      window.removeEventListener('blur',handleFocusViolation);
    };
  },[aid,done,killed]);

  useEffect(()=>{
    if(t<=0 && !subR.current && !done && !killed){
      submit();
      return;
    }
    if(done||killed) return;
    const timer=setInterval(()=>setT((prev)=>prev-1),1000);
    return()=>clearInterval(timer);
  },[t,done,killed]);

  useEffect(()=>{
    if(done||killed) return;
    if(t===300 && !n5){
      setToast({msg:'تبقى 5 دقائق فقط.',type:'w'});
      setN5(true);
    }
    if(t===60 && !n1){
      setToast({msg:'تبقت دقيقة واحدة فقط.',type:'d'});
      setN1(true);
    }
  },[done,killed,n1,n5,t]);

  useEffect(()=>{
    if(!toast) return;
    const timeout=setTimeout(()=>setToast(null),5000);
    return()=>clearTimeout(timeout);
  },[toast]);

  const buildSummary=()=>calculateExamSummary(exam,qs,{
    choiceAnswers:ans,
    textAnswers:textAns,
  });

  const upsertExamAnswer=async(
    questionId:string,
    payload:{
      selected_choice_id?:string|null;
      selected_answer_text?:string|null;
      is_correct?:boolean|null;
    },
  )=>{
    if(!aid) return;

    const sanitizedPayload=sanitizePayloadForTable('exam_answers',payload);
    const {data:existingAnswer,error:existingAnswerError}=await supabase
      .from('exam_answers')
      .select('id')
      .eq('attempt_id',aid)
      .eq('question_id',questionId)
      .maybeSingle<{id:string}>();
    if(existingAnswerError) throw existingAnswerError;

    if(existingAnswer){
      await updateWithSchemaFallback('exam_answers',{column:'id',value:existingAnswer.id},sanitizedPayload);
      return;
    }

    await insertWithSchemaFallback('exam_answers',{
      attempt_id:aid,
      question_id:questionId,
      ...sanitizedPayload,
    });
  };

  const upsertPlatformResult=async(summary:ExamSummary)=>{
    if(!student) return;

    const payload=sanitizePayloadForTable('platform_results',{
      student_id:student.id,
      student_name:student.name,
      exam_id:exam.id,
      exam_title:exam.title,
      tenant_id:student.tenant_id,
      score:summary.score,
      max_score:summary.maxScore,
      subject:exam.subject,
      grade_level:exam.grade_level,
      correct_answers_count:summary.correctCount,
      wrong_answers_count:summary.wrongCount,
      unanswered_answers_count:summary.unansweredCount,
    });

    const {data:existingResult,error:existingResultError}=await supabase
      .from('platform_results')
      .select('id')
      .eq('exam_id',exam.id)
      .eq('student_id',student.id)
      .order('assessment_date',{ascending:false})
      .limit(1)
      .maybeSingle<{id:string}>();
    if(existingResultError) throw existingResultError;

    if(existingResult){
      await updateWithSchemaFallback('platform_results',{column:'id',value:existingResult.id},payload);
      return;
    }

    await insertWithSchemaFallback('platform_results',payload);
  };

  const saveChoiceAnswer=async(questionId:string,choiceId:string)=>{
    if(!aid||killed||done) return;
    const previousChoiceId=ans[questionId];
    setAns((prev)=>({...prev,[questionId]:choiceId}));
    setTextAns((prev)=>{
      if(!(questionId in prev)) return prev;
      const nextAnswers={...prev};
      delete nextAnswers[questionId];
      return nextAnswers;
    });
    try{
      await upsertExamAnswer(questionId,{
        selected_choice_id:choiceId,
        selected_answer_text:null,
      });
    }catch(error){
      console.error('[ExamView] answer autosave failed:',error);
      setAns((prev)=>{
        if(previousChoiceId){
          return {...prev,[questionId]:previousChoiceId};
        }
        const nextAnswers={...prev};
        delete nextAnswers[questionId];
        return nextAnswers;
      });
      setToast({msg:'تعذر حفظ الإجابة الآن. حاول مرة أخرى.',type:'d'});
    }
  };

  const saveTextAnswer=async(questionId:string,value:string)=>{
    if(!aid||killed||done) return;
    const previousAnswer=textAns[questionId] || '';
    setTextAns((prev)=>({...prev,[questionId]:value}));
    try{
      await upsertExamAnswer(questionId,{
        selected_choice_id:null,
        selected_answer_text:value.trim() || null,
      });
    }catch(error){
      console.error('[ExamView] numeric answer autosave failed:',error);
      setTextAns((prev)=>({...prev,[questionId]:previousAnswer}));
      setToast({msg:'تعذر حفظ الإجابة الرقمية الآن. حاول مرة أخرى.',type:'d'});
    }
  };

  const submit=async()=>{
    if(subR.current||killed) return;
    subR.current=true;
    setBusy(true);
    const summary=buildSummary();
    setScr(summary.score);
    setResultSummary(summary);
    try{
      for(const evaluation of summary.evaluations){
        await upsertExamAnswer(evaluation.questionId,{
          selected_choice_id:evaluation.selectedChoiceId,
          selected_answer_text:evaluation.selectedAnswerText,
          is_correct:evaluation.isAnswered ? evaluation.isCorrect : null,
        });
      }

      if(aid){
        await updateWithSchemaFallback('exam_attempts',{column:'id',value:aid},{
          status:'completed',
          finished_at:new Date().toISOString(),
          final_score:summary.score,
        });
      }

      await upsertPlatformResult(summary);

      setDone(true);
    }catch(error){
      console.error('[ExamView] submit failed:',error);
      setToast({msg:getExamInitErrorMessage(error),type:'d'});
    }finally{
      setBusy(false);
      subR.current=false;
    }
  };

  const terminate=async()=>{
    if(subR.current||killed) return;
    subR.current=true;
    try{
      if(aid){
        const {error:terminateError}=await supabase
          .from('exam_attempts')
          .update({status:'terminated'})
          .eq('id',aid);
        if(terminateError) throw terminateError;
      }
      setKilled(true);
    }catch(error){
      console.error('[ExamView] terminate failed:',error);
      setToast({msg:'تعذر إنهاء الامتحان الآن. حاول مرة أخرى.',type:'d'});
      throw error;
    }finally{
      subR.current=false;
    }
  };

  const fmt=(seconds:number)=>`${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}`;
  const isLastMinute=t<60;

  const screen=(color:string,glow:string,icon:React.ReactNode,title:string,body:React.ReactNode)=>(
    <div style={{maxWidth:440,margin:'40px auto',fontFamily:"'Cairo',sans-serif",direction:'rtl',padding:'0 16px',animation:'fadeUp .4s ease both'}}>
      <div className="content-card" style={{padding:'36px 24px',textAlign:'center',borderColor:color,borderRadius:'32px'}}>
        <div style={{width:80,height:80,borderRadius:'50%',background:`${color}18`,border:`1.5px solid ${color}30`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',boxShadow:`0 0 30px ${glow}`}}>
          {icon}
        </div>
        <h2 style={{fontSize:22,fontWeight:900,color:'var(--t1)',marginBottom:10}}>{title}</h2>
        {body}
        <button className="btn btn-violet btn-block btn-lg" style={{marginTop:32,padding:'16px'}} onClick={onComplete}>العودة للرئيسية</button>
      </div>
    </div>
  );

  if(killed){
    return screen(
      'var(--pink)',
      'rgba(255,77,139,.3)',
      <AlertCircle size={36} color="var(--pink)"/>,
      'تم إنهاء الامتحان',
      <p style={{color:'var(--t2)',fontSize:14,lineHeight:1.7,fontWeight:500}}>تم إنهاء الامتحان بسبب الخروج من صفحة الامتحان عدة مرات.</p>,
    );
  }

  if(done){
    const finalMaxScore=Math.max(1,resultSummary?.maxScore || exam.max_score || 1);
    const percentage=Math.round((scr/finalMaxScore)*100);
    return screen(
      'var(--green)',
      'rgba(0,229,160,.3)',
      <CheckCircle size={36} color="var(--green)"/>,
      'تم التسليم بنجاح',
      <>
        <p style={{color:'var(--t3)',fontSize:13,marginBottom:14,fontWeight:500}}>درجتك في هذا الامتحان:</p>
        <div style={{fontSize:54,fontWeight:900,color:'var(--green)',fontFamily:"'JetBrains Mono',monospace",lineHeight:1,textShadow:'0 0 20px rgba(0,229,160,.5)'}}>
          {scr}<span style={{fontSize:22,color:'var(--t3)',fontWeight:600}}>/{finalMaxScore}</span>
        </div>
        <div style={{margin:'14px 0 20px',display:'inline-block',padding:'6px 22px',borderRadius:20,background:'var(--green-bg)',color:'var(--green)',fontSize:15,fontWeight:900,border:'1px solid rgba(0,229,160,.2)'}}>
          {percentage}%
        </div>
        <div className="prog" style={{height:8}}>
          <div className="prog-fill a-bar" style={{width:`${percentage}%`,background:'linear-gradient(90deg,#00A070,#00E5A0)',boxShadow:'0 0 8px rgba(0,229,160,.4)'}}/>
        </div>
        {resultSummary&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginTop:18}}>
            <div style={{padding:'12px 10px',borderRadius:16,background:'rgba(0,229,160,.08)',border:'1px solid rgba(0,229,160,.14)'}}>
              <div style={{fontSize:22,fontWeight:900,color:'var(--green)'}}>{resultSummary.correctCount}</div>
              <div style={{fontSize:12,fontWeight:700,color:'var(--t3)'}}>صحيحة</div>
            </div>
            <div style={{padding:'12px 10px',borderRadius:16,background:'rgba(255,77,139,.08)',border:'1px solid rgba(255,77,139,.14)'}}>
              <div style={{fontSize:22,fontWeight:900,color:'var(--pink)'}}>{resultSummary.wrongCount}</div>
              <div style={{fontSize:12,fontWeight:700,color:'var(--t3)'}}>خاطئة</div>
            </div>
            <div style={{padding:'12px 10px',borderRadius:16,background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.14)'}}>
              <div style={{fontSize:22,fontWeight:900,color:'var(--p2)'}}>{resultSummary.unansweredCount}</div>
              <div style={{fontSize:12,fontWeight:700,color:'var(--t3)'}}>غير مجابة</div>
            </div>
          </div>
        )}
      </>,
    );
  }

  if(loading){
    return(
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'120px 0',gap:16,fontFamily:"'Cairo',sans-serif"}}>
        <div className="spinner" style={{width:44,height:44}} />
        <span style={{color:'var(--t3)',fontSize:15,fontWeight:700}}>جاري تجهيز الامتحان...</span>
      </div>
    );
  }

  if(loadError){
    return(
      <div style={{maxWidth:440,margin:'40px auto',fontFamily:"'Cairo',sans-serif",direction:'rtl',padding:'0 16px'}}>
        <div className="content-card" style={{padding:'36px 24px',textAlign:'center',borderColor:'var(--pink)',borderRadius:'32px'}}>
          <div style={{width:80,height:80,borderRadius:'50%',background:'var(--pink-bg)',border:'1.5px solid rgba(255,77,139,.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',boxShadow:'0 0 30px rgba(255,77,139,.2)'}}>
            <AlertCircle size={36} color="var(--pink)"/>
          </div>
          <h2 style={{fontSize:22,fontWeight:900,color:'var(--t1)',marginBottom:12}}>تعذر تجهيز الامتحان</h2>
          <p style={{color:'var(--t2)',fontSize:14,lineHeight:1.8,fontWeight:600}}>{loadError}</p>
          <div style={{display:'flex',gap:12,marginTop:28}}>
            <button className="btn btn-ghost" style={{flex:1,padding:'14px'}} onClick={onCancel}>رجوع</button>
            <button className="btn btn-violet" style={{flex:1,padding:'14px'}} onClick={()=>setRetryKey((current)=>current+1)}>إعادة المحاولة</button>
          </div>
        </div>
      </div>
    );
  }

  if(!qs.length){
    return(
      <div style={{textAlign:'center',padding:'80px 0',fontFamily:"'Cairo',sans-serif"}}>
        <p style={{color:'var(--t3)',fontSize:15,fontWeight:700,marginBottom:20}}>لا توجد أسئلة متاحة حاليًا.</p>
        <button className="btn btn-ghost" onClick={onCancel}>رجوع</button>
      </div>
    );
  }

  const currentQuestion=qs[qi];
  const currentQuestionImageUrl=String(currentQuestion.image_url || '').trim();
  const isCurrentQuestionImageBroken=Boolean(imgErr[currentQuestion.id]);
  const currentQuestionInputMode=getQuestionInputMode(currentQuestion);

  return(
    <div className="exam-shell">
      {toast&&(
        <div className="a-in" style={{position:'fixed',bottom:32,right:'50%',transform:'translateX(50%)',background:toast.type==='d'?'var(--pink)':'var(--amber)',color:'white',padding:'12px 24px',borderRadius:16,zIndex:200,display:'flex',alignItems:'center',gap:10,boxShadow:'0 12px 40px rgba(0,0,0,.3)',maxWidth:'90vw',border:'1px solid rgba(255,255,255,.2)'}}>
          <Clock size={18}/>
          <span style={{fontSize:14,fontWeight:800,flex:1}}>{toast.msg}</span>
          <button onClick={()=>setToast(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',cursor:'pointer'}}>
            <X size={16}/>
          </button>
        </div>
      )}

      {showW&&(
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,.7)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} className="a-in">
          <div className="content-card a-scale" style={{maxWidth:380,width:'100%',padding:'40px 32px',textAlign:'center',borderColor:'rgba(255,77,139,.3)',borderRadius:'32px'}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:'var(--pink-bg)',border:'1px solid rgba(255,77,139,.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',boxShadow:'0 0 24px rgba(255,77,139,.25)'}}>
              <AlertCircle size={32} color="var(--pink)"/>
            </div>
            <h3 style={{fontSize:22,fontWeight:900,color:'var(--t1)',marginBottom:12}}>تنبيه هام</h3>
            <p style={{color:'var(--t2)',fontSize:14,lineHeight:1.7,fontWeight:600,marginBottom:28}}>
              لقد خرجت من نافذة الامتحان. هذا هو التحذير رقم <span style={{color:'var(--pink)',fontWeight:900,fontSize:18}}>{warn}</span> من أصل 3.
              <br/>{warn===2?'تنبيه: المرة القادمة سيتم إنهاء الامتحان تلقائيًا.':''}
            </p>
            <button className="btn btn-violet btn-block btn-lg" style={{padding:'16px'}} onClick={()=>setShowW(false)}>فهمت، العودة إلى الامتحان</button>
          </div>
        </div>
      )}

      <div className="exam-topbar">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:12,background:isLastMinute?'var(--pink-bg)':'var(--bg3)',border:`1px solid ${isLastMinute?'var(--pink)':'var(--bdr)'}`}}>
            <Clock size={16} color={isLastMinute?'var(--pink)':'var(--p2)'} style={{animation:isLastMinute?'pls 1s ease-in-out infinite':'none'}}/>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:900,fontSize:16,color:isLastMinute?'var(--pink)':'var(--t1)'}}>{fmt(t)}</span>
          </div>
          <span style={{fontSize:13,fontWeight:800,color:'var(--t2)'}}>سؤال {qi+1} من {qs.length}</span>
          <button className="btn btn-danger btn-sm" style={{padding:'6px 14px'}} onClick={()=>window.confirm('هل أنت متأكد من إنهاء الامتحان وتسليم الإجابات؟') && submit()}>
            إنهاء
          </button>
        </div>
        <div className="prog" style={{height:6}}>
          <div className="prog-fill" style={{width:`${((qi+1)/qs.length)*100}%`,background:'linear-gradient(90deg,var(--p2),var(--cyan))',boxShadow:'0 0 10px rgba(124,58,237,.3)',transition:'width .4s ease-out'}}/>
        </div>
      </div>

      <div style={{padding:'20px 16px 40px'}}>
        {currentQuestionImageUrl && !isCurrentQuestionImageBroken&&(
          <div className="content-card exam-image-card">
            <img
              src={currentQuestionImageUrl}
              alt={`Question ${qi+1}`}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={()=>setImgErr((prev)=>({...prev,[currentQuestion.id]:true}))}
              style={{display:'block',width:'100%',maxHeight:'52vh',objectFit:'contain',borderRadius:'20px',background:'rgba(255,255,255,.04)'}}
            />
          </div>
        )}

        {isCurrentQuestionImageBroken&&(
          <div className="content-card" style={{padding:'18px 20px',marginBottom:16,borderRadius:'24px',display:'flex',alignItems:'center',gap:12,borderColor:'rgba(255,77,139,.28)'}}>
            <AlertCircle size={18} color="var(--pink)"/>
            <span style={{color:'var(--t2)',fontSize:14,fontWeight:700}}>تعذر تحميل صورة السؤال على هذا الجهاز.</span>
          </div>
        )}

        <div className="content-card exam-question-card" key={qi}>
          <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
            <div style={{width:38,height:38,borderRadius:12,background:'var(--violet-bg)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'var(--p2)',fontWeight:900,fontSize:16,fontFamily:"'JetBrains Mono',monospace",border:'1.5px solid rgba(124,58,237,.2)'}}>
              {qi+1}
            </div>
            <p style={{fontSize:18,fontWeight:800,color:'var(--t1)',lineHeight:1.7,flex:1,paddingTop:2}}>
              {currentQuestion.question_text}
            </p>
          </div>
        </div>

        {currentQuestionInputMode==='mcq' ? (
          <div className="exam-choice-list">
            {currentQuestion.choices.map((choice)=>{
              const selected=ans[currentQuestion.id]===choice.id;
              return(
                <button key={choice.id} className={`choice${selected?' sel':''}`} style={{padding:'18px 20px',borderRadius:'18px'}} onClick={()=>saveChoiceAnswer(currentQuestion.id,choice.id)}>
                  <span style={{flex:1,fontSize:15,fontWeight:700}}>{choice.choice_text}</span>
                  <div className="choice-dot" style={{width:22,height:22}}>
                    {selected&&<Check size={14} color="var(--bg)" strokeWidth={4}/>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="content-card" style={{padding:'18px 20px',borderRadius:'24px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:12}}>
              <span style={{fontSize:14,fontWeight:900,color:'var(--t1)'}}>الإجابة الرقمية</span>
              {currentQuestion.numeric_tolerance!=null && (
                <span style={{fontSize:12,fontWeight:700,color:'var(--t3)'}}>
                  هامش الخطأ: {currentQuestion.numeric_tolerance}
                </span>
              )}
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={textAns[currentQuestion.id] || ''}
              onChange={(event)=>saveTextAnswer(currentQuestion.id,event.target.value)}
              placeholder="اكتب الإجابة هنا"
              style={{
                width:'100%',
                height:54,
                borderRadius:18,
                border:'1px solid var(--bdr)',
                background:'var(--bg2)',
                color:'var(--t1)',
                padding:'0 16px',
                fontSize:18,
                fontWeight:800,
                outline:'none',
              }}
            />
          </div>
        )}

        <div className="exam-nav-row">
          <button disabled={qi===0} className="btn btn-ghost" style={{flex:1,opacity:qi===0?0.3:1,cursor:qi===0?'not-allowed':'pointer',padding:'16px'}} onClick={()=>setQi((prev)=>prev-1)}>
            <ChevronRight size={20}/>السابق
          </button>
          {qi===qs.length-1 ? (
            <button className="btn btn-green" style={{flex:2,padding:'16px'}} disabled={busy} onClick={()=>window.confirm('هل تريد تسليم الامتحان الآن؟') && submit()}>
              <Send size={18}/>{busy?'جاري الحفظ...':'إكمال وتسليم'}
            </button>
          ) : (
            <button className="btn btn-cyan" style={{flex:2,padding:'16px'}} onClick={()=>setQi((prev)=>prev+1)}>
              السؤال التالي<ChevronLeft size={20}/>
            </button>
          )}
        </div>

        <div className="exam-dot-row">
          {qs.map((_,index)=>(
            <button
              key={index}
              onClick={()=>setQi(index)}
              style={{
                width:index===qi?24:8,
                height:8,
                borderRadius:8,
                border:'none',
                cursor:'pointer',
                background:index===qi?'var(--p2)':(ans[qs[index].id]||String(textAns[qs[index].id] || '').trim())?'var(--green)':'var(--bg3)',
                boxShadow:index===qi?'0 0 10px rgba(124,58,237,.4)':'none',
                transition:'all .3s ease',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExamView;
