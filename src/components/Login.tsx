import React,{useEffect,useRef,useState} from 'react';
import {ensurePortalSupabaseSession,supabase,isSupabaseConfigured} from '../lib/supabase';
import {useAuth} from '../AuthContext';
import {useTheme} from '../ThemeContext';
import {loadStudentProfile} from '../lib/studentProfile';
import {getPhoneSearchVariants,matchesStudentPhone,normalizeIdentity} from '../lib/studentPortalData';
import {portalTenantId} from '../lib/tenant';
import type {Student} from '../types';
import {ArrowRight,CheckCircle2,Hash,Loader2,Moon,Phone,Sun} from 'lucide-react';

const DEFAULT_CENTER_NAME='سنتر الألفا الأستاذ محمد عطية';
const DEFAULT_TEACHER_NAME='الأستاذ';

const loadSettingsFromSupabase=async():Promise<{centerName:string;teacherName:string}>=>{
  console.log('[Login] Loading settings from Supabase...');
  if(!isSupabaseConfigured){
    console.log('[Login] Supabase not configured, using defaults');
    return {centerName:DEFAULT_CENTER_NAME,teacherName:DEFAULT_TEACHER_NAME};
  }

  try{
    await ensurePortalSupabaseSession();
    console.log('[Login] Fetching app_settings...');
    const {data,error}=await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .eq('tenant_id',portalTenantId)
      .in('setting_key',['center_name','teacher_name'])
      .is('deleted_at',null)
      .limit(10);

    console.log('[Login] Supabase response:',{data,error});
    if(error){
      console.warn('[Login] Failed to load settings from Supabase:',error);
      return {centerName:DEFAULT_CENTER_NAME,teacherName:DEFAULT_TEACHER_NAME};
    }

    const settings=(data || []) as {setting_key:string;setting_value:string}[];
    const centerName=settings.find((item)=>item.setting_key==='center_name')?.setting_value || DEFAULT_CENTER_NAME;
    const teacherName=settings.find((item)=>item.setting_key==='teacher_name')?.setting_value || DEFAULT_TEACHER_NAME;
    return {centerName,teacherName};
  }catch(error){
    console.warn('[Login] Error loading settings:',error);
    return {centerName:DEFAULT_CENTER_NAME,teacherName:DEFAULT_TEACHER_NAME};
  }
};

const BASE_SELECT='id,student_code,tenant_id,name,phone,parent_phone,grade_level,balance,is_active';

const dedupeStudents=(students:Student[]):Student[]=>{
  const map=new Map<string,Student>();
  students.forEach((student)=>{
    if(student?.id) map.set(student.id,student);
  });
  return Array.from(map.values());
};

const matchesStudentCode=(student:Pick<Student,'student_code'>,input:string):boolean=>{
  const normalizedInput=normalizeIdentity(input);
  if(!normalizedInput) return false;
  return normalizeIdentity(student.student_code)===normalizedInput;
};

const Login:React.FC=()=>{
  const [code,setCode]=useState('');
  const [phone,setPhone]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [success,setSuccess]=useState(false);
  const [centerName,setCenterName]=useState(DEFAULT_CENTER_NAME);
  const [teacherName,setTeacherName]=useState(DEFAULT_TEACHER_NAME);
  const {login}=useAuth();
  const {isDarkMode,toggleDarkMode}=useTheme();
  const phoneRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if(phoneRef.current) phoneRef.current.focus();

    loadSettingsFromSupabase().then(({centerName,teacherName})=>{
      setCenterName(centerName);
      setTeacherName(teacherName);
    });
  },[]);

  const findCandidatesByPhone=async(rawPhone:string):Promise<Student[]>=>{
    await ensurePortalSupabaseSession().catch(() => false);
    const variants=getPhoneSearchVariants(rawPhone);
    if(!variants.length) return [];

    const exactClauses=variants.flatMap((variant)=>[`phone.eq.${variant}`,`parent_phone.eq.${variant}`]).join(',');
    const exactMatches=await supabase
      .from('students')
      .select(BASE_SELECT)
      .eq('tenant_id',portalTenantId)
      .eq('is_active',true)
      .is('deleted_at',null)
      .or(exactClauses)
      .limit(50);

    if(exactMatches.error) throw exactMatches.error;

    const exactRows=dedupeStudents((exactMatches.data || []) as Student[]).filter((student)=>matchesStudentPhone(student,rawPhone));
    if(exactRows.length>0) return exactRows;

    const fuzzyClauses=variants.flatMap((variant)=>[`phone.ilike.%${variant}%`,`parent_phone.ilike.%${variant}%`]).join(',');
    const fuzzyMatches=await supabase
      .from('students')
      .select(BASE_SELECT)
      .eq('tenant_id',portalTenantId)
      .eq('is_active',true)
      .is('deleted_at',null)
      .or(fuzzyClauses)
      .limit(100);

    if(fuzzyMatches.error) throw fuzzyMatches.error;

    return dedupeStudents((fuzzyMatches.data || []) as Student[]).filter((student)=>matchesStudentPhone(student,rawPhone));
  };

  const findCandidatesByCode=async(rawCode:string):Promise<Student[]>=>{
    await ensurePortalSupabaseSession().catch(() => false);
    const trimmedCode=String(rawCode || '').trim();
    const normalizedCode=normalizeIdentity(trimmedCode);
    if(!normalizedCode) return [];

    const codeVariants=Array.from(new Set([trimmedCode,normalizedCode].filter(Boolean)));
    const codeMatches=await supabase
      .from('students')
      .select(BASE_SELECT)
      .eq('tenant_id',portalTenantId)
      .in('student_code',codeVariants)
      .eq('is_active',true)
      .is('deleted_at',null)
      .limit(20);

    if(codeMatches.error) throw codeMatches.error;

    return dedupeStudents((codeMatches.data || []) as Student[]).filter((student)=>matchesStudentCode(student,normalizedCode));
  };

  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(busy || success) return;

    setError('');
    setBusy(true);

    try{
      const trimmedCode=code.trim();
      const trimmedPhone=phone.trim();

      if(trimmedCode==='101' && trimmedPhone==='0123456789'){
        setTimeout(()=>{
          setSuccess(true);
          setTimeout(()=>{
            login({
              id:'demo-1',
              student_code:'101',
              name:'محمد أحمد علي',
              phone:'0123456789',
              group_name:'مجموعة السبت 4م',
              balance:0,
            });
          },800);
        },1200);
        return;
      }

      const phoneCandidates=await findCandidatesByPhone(trimmedPhone);
      let matchedCandidates=phoneCandidates.filter((candidate)=>matchesStudentCode(candidate,trimmedCode));

      if(matchedCandidates.length===0){
        const codeCandidates=await findCandidatesByCode(trimmedCode);
        matchedCandidates=codeCandidates.filter((candidate)=>matchesStudentPhone(candidate,trimmedPhone));
      }

      if(matchedCandidates.length===0){
        setError('بيانات الدخول غير صحيحة');
        setBusy(false);
        return;
      }

      if(matchedCandidates.length>1){
        setError('يوجد أكثر من طالب مطابق لرقم الهاتف نفسه. تأكد من كود الطالب.');
        setBusy(false);
        return;
      }

      const matchedStudent=matchedCandidates[0];
      const profile=await loadStudentProfile(matchedStudent.id);
      const hydratedStudent={
        ...matchedStudent,
        ...(profile || {}),
      };

      setSuccess(true);
      setTimeout(()=>login(hydratedStudent),1000);
    }catch(error){
      console.error('[Login] submit failed:',error);
      setError('حدث خطأ في الاتصال، حاول لاحقًا');
      setBusy(false);
    }
  };

  return(
    <div className={`login-v4-root ${busy || success ? 'busy-state' : ''} ${error ? 'error-state' : ''}`}>
      <div className="login-v4-header">
        <div className="login-v4-content">
          <div className="v4-logo">
            <img src="/header-logo.png" style={{width:56,height:56,objectFit:'contain'}} alt="Alpha" />
          </div>
          <h1 className="v4-title">{centerName}</h1>
          <p className="v4-sub">{teacherName}</p>
        </div>

        <button onClick={toggleDarkMode} className="v4-theme-btn">
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="login-v4-area">
        <div className="login-v4-card">
          {success ? (
            <div style={{textAlign:'center',padding:'40px 0'}}>
              <CheckCircle2 size={64} style={{color:'var(--green)',margin:'0 auto 20px'}} className="a-scale" />
              <h2 style={{fontSize:22,fontWeight:900,color:'var(--t1)'}}>جارٍ الدخول...</h2>
              <p style={{fontSize:14,color:'var(--t3)',marginTop:8}}>يتم التحقق من بياناتك الآن</p>
            </div>
          ) : (
            <>
              <h2 className="v4-card-title">تسجيل الدخول للمنصة</h2>

              <form onSubmit={submit}>
                <div className="inp-group">
                  <span className="inp-icon"><Phone size={20} /></span>
                  <input
                    ref={phoneRef}
                    type="tel"
                    className="inp-field"
                    placeholder=" "
                    value={phone}
                    onChange={(event)=>setPhone(event.target.value)}
                    required
                  />
                  <label className="inp-label">رقم الطالب أو ولي الأمر</label>
                </div>

                <div className="inp-group">
                  <span className="inp-icon"><Hash size={20} /></span>
                  <input
                    type="text"
                    className="inp-field"
                    placeholder=" "
                    value={code}
                    onChange={(event)=>setCode(event.target.value)}
                    required
                  />
                  <label className="inp-label">كود الطالب</label>
                </div>

                {error && (
                  <div style={{padding:'12px 16px',background:'rgba(244,63,94,0.08)',border:'1px solid rgba(244,63,94,0.2)',borderRadius:14,color:'var(--rose)',fontSize:13,fontWeight:800,marginBottom:24,display:'flex',alignItems:'center',gap:10}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'var(--rose)'}} />
                    {error}
                  </div>
                )}

                <button type="submit" disabled={busy} className="v4-btn">
                  {busy ? (
                    <>
                      <Loader2 size={20} className="v4-spin" />
                      <span>جارٍ التحقق...</span>
                    </>
                  ) : (
                    <>
                      <span>دخول للمنصة</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>

              {!isSupabaseConfigured && !busy && (
                <div style={{marginTop:32,padding:14,borderRadius:16,border:'1.5px dashed var(--bdr)',textAlign:'center',opacity:0.6}}>
                  <div style={{fontSize:10,fontWeight:900,color:'var(--t4)',textTransform:'uppercase'}}>تجربة ديمو</div>
                  <code style={{fontSize:12,color:'var(--p1)'}}>0123456789 | 101</code>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
