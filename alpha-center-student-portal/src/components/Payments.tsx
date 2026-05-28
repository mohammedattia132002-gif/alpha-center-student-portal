/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PaymentRecord, PaymentStatus, PaymentMethod } from '../types/domain';
import { 
  CreditCard, Wallet, Calendar, CheckCircle2, AlertTriangle, 
  Search, Sliders, Printer, Receipt, ShieldCheck, HelpCircle, 
  Sparkles, Check, Download, Landmark, FileText, ArrowUpDown,
  TrendingUp, RefreshCw, Layers, LayoutGrid, DollarSign, X, CheckSquare, Zap, Gift,
  Hourglass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from 'recharts';

interface PaymentsProps {
  records: PaymentRecord[];
  onPayInvoice: (invoiceId: string, method: PaymentMethod) => void;
}

// -------------------------------------------------------------
// TIMER COUNTDOWN FOR INVOICES EXPIRING WITHIN 48 HOURS
// -------------------------------------------------------------
function InvoiceCountdown({ dueDateStr, status }: { dueDateStr: string; status: PaymentStatus }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (status !== 'pending') return;

    const calculateTimeLeft = () => {
      const parts = dueDateStr.split('-');
      if (parts.length !== 3) return null;
      
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      // Target is end of the due date day (23:59:59)
      const targetDate = new Date(year, month, day, 23, 59, 59);
      const now = new Date();
      
      const difference = targetDate.getTime() - now.getTime();
      
      if (difference <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 };
      }
      
      const totalSeconds = Math.floor(difference / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      // Filter so it only alerts within 48 hours
      if (difference <= 48 * 3600 * 1000) {
        return { hours, minutes, seconds };
      }
      return null;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining && remaining.hours === 0 && remaining.minutes === 0 && remaining.seconds === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [dueDateStr, status]);

  if (!timeLeft) return null;

  const isExpired = timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  return (
    <div className={`mt-2 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl border font-sans text-[11px] font-bold transition-all shadow-inner ${
      isExpired 
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    }`} id={`countdown-${dueDateStr}`}>
      <div className="flex items-center gap-1.5 text-right flex-1 select-none">
        <span className="relative flex h-2 w-2">
          {!isExpired && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isExpired ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
        </span>
        {isExpired ? (
          <span>انتهت مهلة الموعد المحدد! 🛑</span>
        ) : (
          <span className="text-amber-800 dark:text-amber-300">
            تنبيه: اقترب موعد الاستحقاق المالي (متبقي أقل من 48 ساعة)
          </span>
        )}
      </div>

      {!isExpired && (
        <div className="flex items-center gap-1 font-mono">
          <Hourglass className="w-3.5 h-3.5 text-amber-500 animate-spin [animation-duration:8s]" />
          <span className="bg-amber-500/20 dark:bg-amber-500/30 px-2 py-0.5 rounded-lg text-amber-700 dark:text-amber-300 tracking-wider">
            {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
          </span>
        </div>
      )}
    </div>
  );
}

export default function Payments({ records, onPayInvoice }: PaymentsProps) {
  const [activeTab, setActiveTab] = useState<'all' | PaymentStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<PaymentRecord | null>(null);
  const [showDemoInvoice, setShowDemoInvoice] = useState(false);
  
  // Checkout flow states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [instaAddress, setInstaAddress] = useState('');
  const [fawryPhone, setFawryPhone] = useState('');
  const [paymentStep, setPaymentStep] = useState<'input' | 'processing' | 'success'>('input');
  
  // Invoice Printable modal
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<PaymentRecord | null>(null);

  // Trigger simulated skeleton loading on filter customization
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(timer);
  }, [activeTab, searchTerm]);

  // Calculate totals
  const totalPaid = records.filter(r => r.status === 'paid').reduce((acc, r) => acc + r.amount, 0);
  const totalPending = records.filter(r => r.status === 'pending').reduce((acc, r) => acc + r.amount, 0);
  const totalFees = totalPaid + totalPending;
  const paidPercent = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 100;

  // Check if any invoice matches the 48h limit
  const hasExpiringInvoice = records.some(inv => {
    if (inv.status !== 'pending') return false;
    const parts = inv.dueDate.split('-');
    if (parts.length !== 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const targetDate = new Date(year, month, day, 23, 59, 59);
    const diff = targetDate.getTime() - new Date().getTime();
    return diff > 0 && diff <= 48 * 3600 * 1000;
  });

  // Filter processes
  const filteredInvoices = records.filter(inv => {
    const matchesTab = activeTab === 'all' || inv.status === activeTab;
    const matchesSearch = (inv.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (inv.receiptNo || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const demoInvoice: PaymentRecord = {
    id: "pay-demo-countdown",
    title: "رسوم ملازم ومذكرات المراجعة النهائية (تجربة العد التنازلي)",
    amount: 150,
    dueDate: (() => {
      const d = new Date();
      d.setHours(d.getHours() + 27); // 27 hours from now
      return d.toISOString().split('T')[0];
    })(),
    status: "pending",
    receiptNo: "INV-2026-DEMO",
    category: "books"
  };

  const finalInvoices = showDemoInvoice 
    ? [demoInvoice, ...filteredInvoices] 
    : filteredInvoices;

  // Start payment checkout trigger
  const handleOpenPayment = (inv: PaymentRecord) => {
    setSelectedInvoiceForPayment(inv);
    setPaymentStep('input');
    setPaymentMethod('credit_card');
    setCardNumber('');
    setCardHolder('');
    setCardExpiry('');
    setCardCvc('');
    setInstaAddress('');
    setFawryPhone('');
  };

  const handleProcessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    setPaymentStep('processing');
    
    // Simulate API Payment Delay
    setTimeout(() => {
      setPaymentStep('success');
      onPayInvoice(selectedInvoiceForPayment.id, paymentMethod);
    }, 1800);
  };

  const closeCheckout = () => {
    setSelectedInvoiceForPayment(null);
    setPaymentStep('input');
  };

  // Sound effects simulator
  const playTapSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch(err){}
  };

  // Recharts Chart Data representing semesters payments
  const chartData = [
    { name: 'يناير', 'المدفوعات الفعيلة': 4000, 'الرسوم المستهدفة': 4000 },
    { name: 'فبراير', 'المدفوعات الفعيلة': 4500, 'الرسوم المستهدفة': 5000 },
    { name: 'مارس', 'المدفوعات الفعيلة': 6000, 'الرسوم المستهدفة': 6000 },
    { name: 'أبريل', 'المدفوعات الفعيلة': totalPaid, 'الرسوم المستهدفة': totalFees }
  ];

  return (
    <div className="space-y-6 text-right md:px-2 animate-in fade-in duration-550" id="mobile-payments-portal">
      
      {/* 1. CREDIT CARD GLASS GLASSMOPHISM FINTECH HEADER CARD */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-750 to-indigo-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-955 text-white rounded-[28px] p-6 relative overflow-hidden shadow-lg border border-white/5 dark:border-white/5 space-y-6">
        
        {/* Glow orbs background decoration */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-b from-indigo-500/20 to-indigo-505/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-505/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-between items-start w-full">
          <div className="text-right">
            <span className="text-[10px] font-black text-indigo-300 font-mono tracking-widest block uppercase">ALPHA CENTER STUDENT CARD</span>
            <span className="text-sm font-bold block mt-1 font-sans">بطاقة سنتر الألفا الأكاديمية الذكية مسبقة الدفع</span>
            <span className="text-xs text-zinc-450 font-mono mt-1 block tracking-wider">0092 1109 4220 {2510 + records.length}</span>
          </div>
          <span className="px-3 py-1 bg-white/10 dark:bg-white/5 border border-white/10 rounded-xl text-[9px] font-mono tracking-wide select-none">GOLD CLASS</span>
        </div>

        {/* Paid Progress Slider gauge */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] text-slate-300 font-sans">
            <span>نسبة الرسوم المسددة: <strong className="text-emerald-400 font-bold font-mono">{paidPercent}%</strong></span>
            <span>الرسوم الدراسية الكلية: {totalFees} جم</span>
          </div>

          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
            <div className="h-full bg-gradient-to-r from-emerald-400 via-[#818cf8] to-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${paidPercent}%` }} />
          </div>

          <div className="flex justify-between items-center text-xs pt-1.5 font-sans border-t border-white/5 mt-2">
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block pb-0.5">إجمالي المسدد</span>
              <span className="font-bold text-emerald-400 font-mono">{totalPaid} جم</span>
            </div>
            <div className="text-left font-mono">
              <span className="text-[9px] text-slate-400 block pb-0.5 text-left font-sans">المتبقي المطلوب سداده</span>
              <span className="font-bold text-rose-455">{totalPending} جم</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. RECHARTS MOUNT-TREND ANALYTICS CARD */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-5 rounded-3xl shadow-[0_4px_18px_rgba(15,23,42,0.02)] space-y-3 relative overflow-hidden">
        <div className="flex justify-between items-center pb-2 border-b border-gray-100/60 dark:border-slate-850/50 select-none">
          <span className="text-[10px] text-neutral-450 dark:text-slate-500 select-none">مقارنة التراكم الشهري للدفعات</span>
          <h3 className="text-xs font-black text-slate-800 dark:text-zinc-150 flex items-center gap-1.5 font-sans">
            <span>التحليل المالي لمدفوعات الطالب</span>
            <TrendingUp className="w-4 h-4 text-indigo-500 animate-pulse" />
          </h3>
        </div>

        <div className="h-44 w-full text-ltr text-xs font-mono py-1" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPaid" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
              <YAxis stroke="#94a3b8" fontSize={9} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} />
              <Area type="monotone" dataKey="المدفوعات الفعيلة" stroke="#818cf8" fillOpacity={1} fill="url(#colorPaid)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. SEARCH BAR & INVOICE FILTER CHIPS */}
      <div className="bg-white/80 backdrop-blur-md dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 p-4.5 rounded-3xl space-y-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.02)]">
        <div className="relative">
          <input 
            type="text"
            placeholder="البحث برقم الفاتورة أو البند المالي..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-3 pr-10 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200/50 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-sans"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Filter keys tab bar */}
        <div className="flex gap-2 justify-start select-none">
          {[
            { tag: 'all', title: 'كافة المعاملات' },
            { tag: 'paid', title: 'فواتير مكتملة' },
            { tag: 'pending', title: 'قيد المراجعة / السداد' }
          ].map((tab) => (
            <button
              key={tab.tag}
              onClick={() => { setActiveTab(tab.tag as any); playTapSound(); }}
              className={`px-3.5 py-1.5 rounded-xl font-bold font-sans text-[10px] cursor-pointer transition-all ${
                activeTab === tab.tag
                  ? 'bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-500/20'
                  : 'bg-neutral-50 dark:bg-slate-950 text-neutral-450 dark:text-zinc-400 hover:bg-neutral-200 dark:hover:bg-slate-850/60'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* 4. PREMIUM INVOICES LISTINGS - STRACK RECLIST CARDS */}
      <div className="space-y-3">
        <div className="flex justify-between items-center pr-1 select-none">
          <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 font-sans tracking-wide">قائمة الفواتير الأكاديمية والالتزامات</h3>
          {!hasExpiringInvoice && (
            <button
              onClick={() => { setShowDemoInvoice(!showDemoInvoice); playTapSound(); }}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black font-sans cursor-pointer transition-all flex items-center gap-1 ${
                showDemoInvoice 
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30' 
                  : 'bg-indigo-50 dark:bg-slate-950 text-indigo-650 dark:text-indigo-400 border border-neutral-200/50 dark:border-slate-850 hover:bg-indigo-100 dark:hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              <span>{showDemoInvoice ? 'إخفاء عرض الفاتورة التجريبية' : 'محاكاة فاتورة قريبة لتجربة العداد ⏱️'}</span>
            </button>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="p-4 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 rounded-2xl animate-pulse flex justify-between">
                <div className="w-14 h-5 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="space-y-2 flex-1 text-right flex flex-col pr-4">
                  <div className="w-1/3 h-4 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                  <div className="w-1/4 h-3 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                </div>
              </div>
            ))
          ) : finalInvoices.length === 0 ? (
            <div className="p-8 text-center rounded-2.5xl bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 select-none font-sans text-xs text-neutral-455">
              لا توجد أية التزامات مالية مطابقة لخيارات الفلترة الحالية 💳
            </div>
          ) : (
            finalInvoices.map((inv) => (
              <motion.div
                key={inv.id}
                layoutId={`financial-card-${inv.id}`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="p-4 bg-white/80 backdrop-blur-sm dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850/60 rounded-2xl relative overflow-hidden shadow-[0_2px_10px_rgba(15,23,42,0.012)] hover:border-indigo-400 dark:hover:border-indigo-505/30 transition-all flex flex-col gap-3 text-right"
              >
                {/* Visual side marker indicating unpaid/paid status */}
                <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${inv.status === 'paid' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />

                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <h4 className="text-xs font-black text-slate-800 dark:text-zinc-150">{inv.title}</h4>
                    <span className="text-[10px] text-neutral-400 dark:text-slate-500 block mt-1 font-sans font-mono">فاتورة ريكورد: {inv.receiptNo || inv.id} • {inv.dueDate}</span>
                  </div>

                  <span className={`text-[10px] font-black px-2.5 pb-0.5 pt-1 rounded-xl ${
                    inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450' : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 animate-pulse'
                  } border`}>
                    {inv.status === 'paid' ? 'مكتمل السداد' : 'بانتظار السداد'}
                  </span>
                </div>

                {/* Real-time countdown on pending invoices due in <= 48 hours */}
                <InvoiceCountdown dueDateStr={inv.dueDate} status={inv.status} />

                <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-neutral-200/50 dark:border-slate-850/80">
                  <div className="text-right">
                    <span className="text-[9px] text-neutral-450 dark:text-slate-500 block font-sans leading-none pb-0.5">مبلغ البند المالي</span>
                    <span className="text-xs font-bold text-indigo-650 dark:text-indigo-400 font-mono">{inv.amount} جم</span>
                  </div>

                  <div className="flex gap-2">
                    {inv.status === 'pending' ? (
                      <button
                        onClick={() => { handleOpenPayment(inv); playTapSound(); }}
                        className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black cursor-pointer transition-colors shadow-sm cursor-pointer"
                      >
                        سداد الآن المباشر
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSelectedInvoiceForPrint(inv); playTapSound(); }}
                        className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-850 text-neutral-650 dark:text-neutral-300 rounded-xl text-[10px] font-black cursor-pointer transition-colors cursor-pointer"
                      >
                        طباعة الإيصال 📑
                      </button>
                    )}
                  </div>
                </div>

              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* 5. SECURE COMPACT BANNER CARD */}
      <div className="p-3.5 bg-neutral-100/55 dark:bg-slate-900/60 rounded-2.5xl border border-neutral-200/20 dark:border-slate-850/60 text-[10px] text-gray-500 dark:text-zinc-400 font-sans leading-relaxed flex items-start gap-2 shadow-inner select-none">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 animate-pulse" />
        <p className="text-right flex-1 leading-normal">
          بوابة الدفع الآمنة الكلية للنخبة مشفرة بالكامل بتكنولوجيا <strong>Stripe ومركز الدفع الفيدرالي</strong>. يتم تشفير معاملاتك البنكية، بطاقات الائتمان، ومحفظة Fawry دون حفظ أي أرقام حساسة.
        </p>
      </div>

      {/* 6. COGNITIVE PAYMENT CHECKOUT DRAWER */}
      <AnimatePresence>
        {selectedInvoiceForPayment && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={closeCheckout}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />

            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-900 rounded-t-[32px] border-t border-white/10 p-5.5 z-10 w-full space-y-4 max-h-[85%] overflow-y-auto font-sans text-right select-none"
              dir="rtl"
            >
              <div className="w-12 h-1 bg-gray-300 dark:bg-neutral-800 rounded-full mx-auto" />

              <div className="flex items-center justify-between border-b border-gray-100/60 dark:border-slate-850/50 pb-3">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">بوابة السداد الفوري الآمنة</h3>
                  <p className="text-[10px] text-neutral-450 block mt-0.5">سداد مالي معتمد للبند: {selectedInvoiceForPayment.title}</p>
                </div>
                <button 
                  onClick={closeCheckout}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-full text-neutral-450 cursor-pointer animate-pulse"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {paymentStep === 'success' ? (
                <div className="py-10 text-center space-y-4 flex flex-col items-center">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                    <CheckSquare className="w-8 h-8 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-sm font-black text-emerald-505">تم السداد الإلكتروني بنجاح! 🎉</span>
                    <p className="text-xs text-neutral-400">تلقينا تبريك السداد وتم تحويل قيمة <strong>{selectedInvoiceForPayment.amount} جم</strong> لحساب الخزينة.</p>
                  </div>
                  <button 
                    onClick={closeCheckout}
                    className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-850 text-neutral-700 dark:text-neutral-300 font-bold rounded-2xl text-xs cursor-pointer"
                  >
                    رائع، إغلاق البوابة
                  </button>
                </div>
              ) : paymentStep === 'processing' ? (
                <div className="py-12 text-center space-y-4 flex flex-col items-center">
                  <div className="relative flex items-center justify-center">
                    <div className="w-11 h-11 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
                    <Sparkles className="w-4 h-4 text-indigo-505 absolute animate-pulse" />
                  </div>
                  <div className="space-y-0.5 animate-pulse">
                    <span className="block text-xs font-black text-zinc-800 dark:text-zinc-200">جاري تشفير ومعالجة العملية المصرفية...</span>
                    <p className="text-[10px] text-neutral-450">الرجاء عدم إغلاق النافذة، جاري الربط الآمن مع فوري وبوابة Stripe.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleProcessSubmit} className="space-y-4 text-right">
                  
                  {/* Total summary info */}
                  <div className="p-3.5 bg-neutral-50 dark:bg-slate-950 border border-neutral-150 rounded-2xl flex justify-between items-center text-right">
                    <div className="text-right">
                      <span className="text-[11px] font-black text-slate-800 dark:text-zinc-200 block">{selectedInvoiceForPayment.title}</span>
                      <span className="block text-[9px] text-zinc-400 mt-0.5">القيمة الكلية للبند الدراسي</span>
                    </div>
                    <span className="text-xs font-black text-indigo-650 dark:text-indigo-400 font-mono">{selectedInvoiceForPayment.amount} جم</span>
                  </div>

                  {/* Payment Methods selector tabs */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-850 dark:text-zinc-300 block">اختر وسيلة الدفع المناسبة لك:</label>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => { setPaymentMethod('credit_card'); playTapSound(); }}
                        className={`p-2.5 border rounded-2xl text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          paymentMethod === 'credit_card' 
                            ? 'border-indigo-500 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'border-neutral-200 dark:border-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-850 text-neutral-455'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span className="text-[9px]">البطاقة الائتمانية</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setPaymentMethod('instapay'); playTapSound(); }}
                        className={`p-2.5 border rounded-2xl text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          paymentMethod === 'instapay'
                            ? 'border-indigo-500 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'border-neutral-200 dark:border-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-850 text-neutral-455'
                        }`}
                      >
                        <Landmark className="w-4 h-4" />
                        <span className="text-[9px]">إنستا باي IPN</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setPaymentMethod('fawry'); playTapSound(); }}
                        className={`p-2.5 border rounded-2xl text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          paymentMethod === 'fawry'
                            ? 'border-indigo-500 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'border-neutral-200 dark:border-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-850 text-neutral-455'
                        }`}
                      >
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-[9px]">فوري Fawry</span>
                      </button>
                    </div>
                  </div>

                  {/* Form fields conditional styling */}
                  <AnimatePresence mode="wait">
                    {paymentMethod === 'credit_card' && (
                      <motion.div 
                        key="credit"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                      >
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 dark:text-zinc-300">اسم صاحب البطاقة المطبوع:</label>
                          <input 
                            required 
                            type="text" 
                            placeholder="MOHAMED AHMED ALI"
                            value={cardHolder} 
                            onChange={(e) => setCardHolder(e.target.value)}
                            className="w-full text-xs p-2.5 text-right bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-850 rounded-xl"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 dark:text-zinc-300">رقم البطاقة (16 رقم):</label>
                          <input 
                            required 
                            type="text" 
                            maxLength={19}
                            placeholder="4000 1234 5678 9010"
                            value={cardNumber} 
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="w-full text-xs p-2.5 text-right font-mono bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-850 rounded-xl"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-400 dark:text-zinc-300">تاريخ الانتهاء MM/YY:</label>
                            <input 
                              required 
                              type="text" 
                              maxLength={5}
                              placeholder="12/28"
                              value={cardExpiry} 
                              onChange={(e) => setCardExpiry(e.target.value)}
                              className="w-full text-xs p-2.5 text-right font-mono bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-850 rounded-xl"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-400 dark:text-zinc-300">الرمز السري CVC:</label>
                            <input 
                              required 
                              type="password" 
                              maxLength={3}
                              placeholder="***"
                              value={cardCvc} 
                              onChange={(e) => setCardCvc(e.target.value)}
                              className="w-full text-xs p-2.5 text-right font-mono bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-850 rounded-xl"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {paymentMethod === 'instapay' && (
                      <motion.div 
                        key="instapay"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                      >
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 dark:text-zinc-300">العنوان التعريفي InstaPay IPA:</label>
                          <input 
                            required 
                            type="text" 
                            placeholder="name@instapay" 
                            value={instaAddress}
                            onChange={(e) => setInstaAddress(e.target.value)}
                            className="w-full text-xs p-3 text-right font-mono bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-850 rounded-xl"
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 block leading-normal leading-relaxed">
                          سيتم سحب القيمة المالية آمنًا من حسابك بعد تأكيد العملية من تطبيق إنستا باي الموبايل بإدخال الرمز السري IPN PIN.
                        </span>
                      </motion.div>
                    )}

                    {paymentMethod === 'fawry' && (
                      <motion.div 
                        key="fawry"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                      >
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 dark:text-zinc-300">رقم الهاتف المحمول لخدمة فوري:</label>
                          <input 
                            required 
                            type="tel" 
                            placeholder="01012345678" 
                            value={fawryPhone}
                            onChange={(e) => setFawryPhone(e.target.value)}
                            className="w-full text-xs p-3 text-right font-mono bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-850 rounded-xl"
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 block leading-normal leading-relaxed">
                          سنرسل كود الدفع Fawry Pay في رسالة نصية SMS لهاتفك. يمكنك الدفع من أقرب منفذ فوري أو محفظة رقمية خلال 48 ساعة.
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submission and exit list */}
                  <div className="flex gap-3 pt-3">
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs transition-colors shadow-xs cursor-pointer active:scale-98"
                    >
                      تأكيد الدفع المشفر
                    </button>
                    <button 
                      type="button"
                      onClick={closeCheckout}
                      className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-850 text-neutral-700 dark:text-neutral-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>

                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. PRINTABLE RECEIPT STYLE MODAL DETAIL OVERLAY */}
      <AnimatePresence>
        {selectedInvoiceForPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedInvoiceForPrint(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs" 
            />

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-3xl p-6 z-10 w-full max-w-sm relative shadow-2xl space-y-5 text-right border border-neutral-200 dark:border-slate-800 font-sans"
              dir="rtl"
            >
              <button 
                onClick={() => setSelectedInvoiceForPrint(null)}
                className="absolute top-4 left-4 p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-full text-neutral-400 dark:text-zinc-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-1 pt-2 select-none">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Receipt className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white font-sans">بوابة سنتر الألفا - إيصال سداد رسوم</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono tracking-widest leading-none block">STUDENT TRANSACTION RECEIPT</p>
              </div>

              {/* Barcode/dash decoration visual */}
              <div className="border-t border-dashed border-neutral-200 dark:border-slate-800 relative my-3">
                <div className="absolute -left-8 -top-2.5 w-5 h-5 bg-black/90 dark:bg-slate-950 rounded-full" />
                <div className="absolute -right-8 -top-2.5 w-5 h-5 bg-black/90 dark:bg-slate-950 rounded-full" />
              </div>

              <div className="space-y-2.5 text-xs pr-1">
                <div className="flex justify-between text-right">
                  <span className="text-gray-500 dark:text-zinc-400">رقم الإيصال / المعاملة:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-zinc-100">{selectedInvoiceForPrint.receiptNo || selectedInvoiceForPrint.id}</span>
                </div>
                <div className="flex justify-between text-right">
                  <span className="text-gray-500 dark:text-zinc-400">تاريخ دفع البند المالي:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-zinc-100">{selectedInvoiceForPrint.paidAt || '2026-05-10'}</span>
                </div>
                <div className="flex justify-between text-right">
                  <span className="text-gray-500 dark:text-zinc-400">البند المستخلص للدفع:</span>
                  <span className="font-black text-slate-800 dark:text-zinc-200">{selectedInvoiceForPrint.title}</span>
                </div>
                <div className="flex justify-between text-right">
                  <span className="text-gray-500 dark:text-zinc-400">المستلم:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-100">خزينة شؤون الطلاب المركزية</span>
                </div>
              </div>

              {/* Printable dash visual card total */}
              <div className="p-3 bg-neutral-50 dark:bg-slate-950 rounded-2xl flex justify-between items-center text-right border border-neutral-200/50 dark:border-slate-850">
                <span className="text-xs font-black text-slate-800 dark:text-zinc-200">إجمالي الرسوم المسددة:</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{selectedInvoiceForPrint.amount} جم</span>
              </div>

              <div className="space-y-2 select-none pt-1">
                <button 
                  onClick={() => { window.print(); }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الإيصال الورقي وتصديره PDF</span>
                </button>
                <button 
                  onClick={() => setSelectedInvoiceForPrint(null)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-750 dark:text-slate-300 font-bold rounded-2xl text-[11px] transition-colors cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
