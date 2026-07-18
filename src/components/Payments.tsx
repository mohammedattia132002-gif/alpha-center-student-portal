/**

 * @license

 * SPDX-License-Identifier: Apache-2.0

 */



import { useEffect, useMemo, useState } from 'react';

import { PaymentRecord, PaymentStatus, CenterConfig } from '../types';

import {

  AlertTriangle,

  Calendar,

  FileText,

  HelpCircle,

  Info,

  Landmark,

  Phone,

  Printer,

  Receipt,

  Search,

  WifiOff,

  X,

} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

import { playPortalTap } from '../lib/audioFeedback';



interface PaymentsProps {

  records: PaymentRecord[];

  centerConfig: CenterConfig;

  isOnline?: boolean;

}



function InvoiceCountdown({ dueDateStr, status }: { dueDateStr: string; status: PaymentStatus }) {

  const [timeLeft, setTimeLeft] = useState<{

    days: number;

    hours: number;

    minutes: number;

    seconds: number;

    isFar: boolean;

  } | null>(null);



  useEffect(() => {

    if (status !== 'pending' && status !== 'partial') {

      return;

    }



    const calculateTimeLeft = () => {

      const parts = dueDateStr.split('-');

      if (parts.length !== 3) {

        return null;

      }



      const year = parseInt(parts[0], 10);

      const month = parseInt(parts[1], 10) - 1;

      const day = parseInt(parts[2], 10);

      const targetDate = new Date(year, month, day, 23, 59, 59);

      const now = new Date();

      const difference = targetDate.getTime() - now.getTime();



      if (difference <= 0) {

        return { days: 0, hours: 0, minutes: 0, seconds: 0, isFar: false };

      }



      const totalSeconds = Math.floor(difference / 1000);

      const days = Math.floor(totalSeconds / (3600 * 24));

      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);

      const minutes = Math.floor((totalSeconds % 3600) / 60);

      const seconds = totalSeconds % 60;



      return { days, hours, minutes, seconds, isFar: difference > 48 * 3600 * 1000 };

    };



    setTimeLeft(calculateTimeLeft());



    const timer = setInterval(() => {

      setTimeLeft(calculateTimeLeft());

    }, 1000);



    return () => clearInterval(timer);

  }, [dueDateStr, status]);



  if (!timeLeft) {

    return null;

  }



  const isExpired =

    timeLeft.days === 0 &&

    timeLeft.hours === 0 &&

    timeLeft.minutes === 0 &&

    timeLeft.seconds === 0;



  if (isExpired) {

    return (

      <div className="mt-2 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border font-sans text-[11px] font-bold bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-inner">

        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />

        <span>انتهت مهلة السداد المحددة لهذا الطلب.</span>

      </div>

    );

  }



  if (timeLeft.isFar) {

    return (

      <div className="mt-2 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border font-sans text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-inner">

        <Calendar className="w-3.5 h-3.5 shrink-0" />

        <span>

          موعد الاستحقاق متبق له {timeLeft.days} يوم و {timeLeft.hours} ساعة.

        </span>

      </div>

    );

  }



  return (

    <div className="mt-2 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl border font-sans text-[11px] font-bold transition-all shadow-inner bg-amber-500/10 text-amber-400 border-amber-500/20">

      <div className="flex items-center gap-1.5 text-right flex-1">

        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />

        <span>الموعد قريب: أقل من 48 ساعة متبقية على موعد الاستحقاق.</span>

      </div>



      <span className="bg-amber-500/30 px-2 py-0.5 rounded-lg text-amber-300 font-mono tracking-wider">

        {String(timeLeft.hours).padStart(2, '0')}:

        {String(timeLeft.minutes).padStart(2, '0')}:

        {String(timeLeft.seconds).padStart(2, '0')}

      </span>

    </div>

  );

}



function getStatusMeta(status: PaymentStatus) {

  if (status === 'paid') {

    return {

      label: 'مسدد',

      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',

      markerClass: 'bg-emerald-500',

    };

  }



  if (status === 'overdue') {

    return {

      label: 'متأخر',

      className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',

      markerClass: 'bg-rose-500',

    };

  }

  if (status === 'partial') {

    return {

      label: 'مدفوع جزئياً',

      className: 'bg-sky-500/10 text-sky-400 border-sky-500/20',

      markerClass: 'bg-sky-500',

    };

  }

  if (status === 'waived') {

    return {

      label: 'مُعفى',

      className: 'bg-violet-500/10 text-violet-400 border-violet-500/20',

      markerClass: 'bg-violet-500',

    };

  }



  return {

    label: 'قيد المتابعة',

    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',

    markerClass: 'bg-amber-500',

  };

}



function escapeHtml(value: string): string {

  return value

    .replaceAll('&', '&amp;')

    .replaceAll('<', '&lt;')

    .replaceAll('>', '&gt;')

    .replaceAll('"', '&quot;')

    .replaceAll("'", '&#39;');

}



function buildReceiptHtml(invoice: PaymentRecord, centerConfig: CenterConfig): string {

  const paidDate = invoice.paidDate?.trim() || 'غير مسدد';

  const centerName = centerConfig.centerName.trim() || 'السنتر';

  return `<!doctype html>

<html lang="ar" dir="rtl">

  <head>

    <meta charset="utf-8" />

    <title>إيصال سداد</title>

    <style>

      @page { margin: 8mm; size: A5 portrait; }

      body { font-family: 'Cairo', 'Tahoma', Arial, sans-serif; margin: 0; padding: 0; color: #0f172a; background: #fff; }

      .card { max-width: 380px; margin: 16px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

      .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 24px; text-align: center; }

      .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }

      .header p { margin: 4px 0 0; font-size: 11px; opacity: 0.85; }

      .body { padding: 20px 24px; }

      .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }

      .row:last-of-type { border-bottom: none; }

      .label { font-size: 12px; color: #64748b; }

      .value { font-weight: 700; font-size: 13px; color: #0f172a; direction: ltr; text-align: left; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .amount-box { margin-top: 16px; padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #a7f3d0; text-align: center; }

      .amount-box .label { display: block; font-size: 11px; color: #047857; font-weight: 600; margin-bottom: 4px; }

      .amount-box .amount { font-size: 28px; font-weight: 900; color: #047857; }

      .amount-box .currency { font-size: 14px; font-weight: 700; color: #047857; margin-right: 2px; }

      .status { display: inline-block; margin-top: 12px; padding: 4px 16px; border-radius: 20px; font-size: 11px; font-weight: 700; }

      .status-paid { background: #dcfce7; color: #166534; }

      .status-pending { background: #fef3c7; color: #92400e; }

      .footer-note { margin-top: 16px; padding: 12px 20px; background: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10px; color: #94a3b8; }

      @media print {

        body { background: #fff; }

        .card { box-shadow: none; border: 1px solid #e2e8f0; margin: 0; max-width: 100%; }

        .amount-box { break-inside: avoid; }

      }

    </style>

  </head>

  <body>

    <div class="card">

      <div class="header">

        <h1>${escapeHtml(centerName)}</h1>

        <p>إيصال سداد</p>

      </div>

      <div class="body">

        <div class="row">

          <span class="label">البيان</span>

          <span class="value">${escapeHtml(invoice.title)}</span>

        </div>

        <div class="row">

          <span class="label">تاريخ الاستحقاق</span>

          <span class="value">${escapeHtml(invoice.dueDate)}</span>

        </div>

        <div class="row">

          <span class="label">تاريخ السداد</span>

          <span class="value">${escapeHtml(paidDate)}</span>

        </div>

        <div class="row">

          <span class="label">الحالة</span>

          <span class="value"><span class="status ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">${invoice.status === 'paid' ? 'مدفوع' : 'غير مدفوع'}</span></span>

        </div>

        <div class="amount-box">

          <span class="label">المبلغ</span>

          <span class="amount">${escapeHtml(String(invoice.amount))}<span class="currency">ج.م</span></span>

        </div>

      </div>

      <div class="footer-note">

        هذا إيصال إلكتروني معتمد من السنتر ولا يحتاج لتوقيع

      </div>

    </div>

  </body>

</html>`;

}



export default function Payments({ records, centerConfig, isOnline = true }: PaymentsProps) {

  const [activeTab, setActiveTab] = useState<'all' | PaymentStatus>('all');

  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const [selectedInvoiceForInstructions, setSelectedInvoiceForInstructions] = useState<PaymentRecord | null>(null);

  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<PaymentRecord | null>(null);

  const closeInstructionsDialog = () => setSelectedInvoiceForInstructions(null);

  const closePrintDialog = () => setSelectedInvoiceForPrint(null);

  const instructionsDialogRef = useAccessibleDialog<HTMLDivElement>(

    Boolean(selectedInvoiceForInstructions),

    closeInstructionsDialog,

  );

  const printDialogRef = useAccessibleDialog<HTMLDivElement>(

    Boolean(selectedInvoiceForPrint),

    closePrintDialog,

  );



  useEffect(() => {

    setIsLoading(true);

    const timer = setTimeout(() => setIsLoading(false), 350);

    return () => clearTimeout(timer);

  }, [activeTab, searchTerm]);



  const supportPhone = centerConfig.phoneNumber.trim();

  const chargeRecords = records.filter((record) => record.recordType === 'charge');
  const totalPaid = chargeRecords.length > 0
    ? chargeRecords.reduce(
        (sum, record) => sum + Math.min(record.amountDue ?? record.amount, record.paidAmount ?? 0),
        0,
      )
    : records
        .filter((record) => record.recordType === 'payment' && record.status === 'paid')
        .reduce((sum, record) => sum + record.amount, 0);

  const totalPending = chargeRecords
    .filter((record) => record.status === 'pending' || record.status === 'partial')
    .reduce((sum, record) => sum + record.amount, 0);

  const totalOverdue = chargeRecords
    .filter((record) => record.status === 'overdue')
    .reduce((sum, record) => sum + record.amount, 0);

  const totalFees = chargeRecords.length > 0
    ? chargeRecords.reduce((sum, record) => sum + (record.amountDue ?? record.amount), 0)
    : totalPaid;

  const paidPercent = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 100;



  const hasExpiringInvoice = records.some((invoice) => {

    if (invoice.status !== 'pending' && invoice.status !== 'partial') {

      return false;

    }



    const parts = invoice.dueDate.split('-');

    if (parts.length !== 3) {

      return false;

    }



    const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59);

    const diff = targetDate.getTime() - new Date().getTime();

    return diff > 0 && diff <= 48 * 3600 * 1000;

  });



  const finalInvoices = useMemo(() => {

    return [...records]

      .filter((invoice) => {

        const matchesTab = activeTab === 'all' || invoice.status === activeTab;

        const matchesSearch =

          invoice.title.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesTab && matchesSearch;

      })

      .sort((a, b) => {

        const timeDiff = new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();

        if (timeDiff !== 0) {

          return timeDiff;

        }

        return b.id.localeCompare(a.id);

      });

  }, [activeTab, records, searchTerm]);



  const playTapSound = () => playPortalTap(720);



  const handlePrintReceipt = (invoice: PaymentRecord | null) => {

    if (!invoice) {

      return;

    }



    const printWindow = window.open('', '_blank', 'width=420,height=640,scrollbars=yes');

    if (!printWindow || printWindow.closed) {

      return;

    }



    printWindow.document.write(buildReceiptHtml(invoice, centerConfig));

    printWindow.document.close();

    setTimeout(() => {

      printWindow.focus();

      printWindow.print();

    }, 300);

  };



  return (

    <div className="space-y-6 lg:space-y-8 text-right md:px-2 animate-in fade-in duration-550" id="mobile-payments-portal">

      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-955 text-white rounded-[28px] p-6 relative overflow-hidden shadow-lg border border-white/5 space-y-4">

        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-505/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-indigo-505/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-between items-center pb-3 border-b border-white/10">

          <div className="text-right">

            <h3 className="text-xs font-black text-white font-sans">حالة الرسوم والبنود المالية</h3>

            <p className="text-[10px] text-emerald-100/80 mt-0.5">عرض متابعة فقط لفواتير سنتر {centerConfig.centerName}</p>

          </div>

          <div className="p-2 bg-white/10 text-emerald-200 rounded-2xl border border-white/15">

            <Landmark className="w-5 h-5" />

          </div>

        </div>



        <div className="space-y-3">

          <div className="flex justify-between items-center text-xs text-emerald-100/90 font-sans">

            <span className="font-bold">

              نسبة المسدد: <strong className="text-emerald-300 font-extrabold font-mono text-sm">{paidPercent}%</strong>

            </span>

          </div>



          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden border border-white/10 p-0.5">

            <div className="h-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-indigo-400 rounded-full transition-all duration-1000" style={{ width: `${paidPercent}%` }} />

          </div>



          <div className="flex justify-between items-center text-xs pt-3 font-sans border-t border-white/10 mt-2">

            <div className="text-right">

              <span className="text-[10px] text-emerald-100/70 block pb-0.5">المتبقي</span>

              <span className="font-bold text-amber-300 font-mono text-sm">{totalPending} ج.م</span>

            </div>

            <div className="text-left">

              <span className="text-[10px] text-emerald-100/70 block pb-0.5 text-left font-sans">المتأخر</span>

              <span className="font-bold text-rose-300 text-sm">{totalOverdue} ج.م</span>

            </div>

          </div>

        </div>

      </div>







      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-850/60 p-4.5 rounded-3xl space-y-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.02)] relative overflow-hidden">
        <div className="absolute -top-8 right-1/3 w-28 h-28 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-indigo-505/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative">

          <label htmlFor="payments-search" className="sr-only">البحث في الفواتير والبنود المالية</label>

          <input

            id="payments-search"

            type="text"

            placeholder="البحث باسم الطالب..."

            value={searchTerm}

            onChange={(event) => setSearchTerm(event.target.value)}

            className="w-full text-xs p-3 pr-10 text-right bg-slate-950 border border-slate-850 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 transition-all font-sans"

          />

          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />

        </div>



        <div className="flex gap-2 justify-start select-none flex-wrap">

          {[

            { tag: 'all', title: 'كل البنود' },

            { tag: 'paid', title: 'المسددة' },

            { tag: 'pending', title: 'قيد المتابعة' },

            { tag: 'partial', title: 'مدفوعة جزئياً' },

            { tag: 'overdue', title: 'المتأخرة' },

            { tag: 'waived', title: 'المُعفاة' },

          ].map((tab) => (

            <button

              key={tab.tag}

              onClick={() => {

                setActiveTab(tab.tag as 'all' | PaymentStatus);

                playTapSound();

              }}

              aria-pressed={activeTab === tab.tag}

              className={`px-3.5 py-1.5 rounded-xl font-bold font-sans text-[10px] cursor-pointer transition-all ${

                activeTab === tab.tag

                  ? 'bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-500/20'

                  : 'bg-slate-950 text-zinc-300 hover:bg-slate-850/60'

              }`}

            >

              {tab.title}

            </button>

          ))}

        </div>

      </div>



      <div className="space-y-3">

        <div className="flex justify-between items-center pr-1 select-none">

          <h3 className="text-xs font-black text-slate-300 font-sans tracking-wide">قائمة الفواتير والالتزامات</h3>

        </div>



        <AnimatePresence mode="popLayout">

          {isLoading ? (

            Array.from({ length: 2 }).map((_, index) => (

              <div key={index} className="p-4 bg-slate-900/40 backdrop-blur-sm border border-slate-850 rounded-2xl animate-pulse flex justify-between">

                <div className="w-14 h-5 bg-slate-800 rounded-lg animate-pulse" />

                <div className="space-y-2 flex-1 text-right flex flex-col pr-4">

                  <div className="w-1/3 h-4 bg-slate-800 rounded-lg animate-pulse" />

                  <div className="w-1/4 h-3 bg-slate-800 rounded-lg animate-pulse" />

                </div>

              </div>

            ))

          ) : finalInvoices.length === 0 ? (

            <div className="p-8 text-center rounded-2.5xl bg-slate-900/40 backdrop-blur-sm border border-slate-850 select-none font-sans text-xs text-neutral-455">

              لا توجد بنود مالية مطابقة لخيارات العرض الحالية.

            </div>

          ) : (

            finalInvoices.map((invoice) => {

              const statusMeta = getStatusMeta(invoice.status);



              return (

                <motion.div

                  key={invoice.id}

                  layoutId={`financial-card-${invoice.id}`}

                  whileHover={{ scale: 1.01 }}

                  whileTap={{ scale: 0.99 }}

                  className="p-4 bg-slate-900/40 backdrop-blur-sm border border-slate-850/60 rounded-2xl relative overflow-hidden shadow-[0_2px_10px_rgba(15,23,42,0.012)] hover:border-indigo-505/30 transition-all flex flex-col gap-3 text-right"

                >

                  <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${statusMeta.markerClass}`} />



                  <div className="flex justify-between items-start gap-3">

                    <div className="text-right flex-1">

                      <h4 className="text-sm font-black text-zinc-100">{invoice.title}</h4>

                    </div>

                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border shrink-0 ${statusMeta.className}`}>

                      {statusMeta.label}

                    </span>

                  </div>



                  <div className="grid grid-cols-2 gap-3 text-[11px]">

                    <div className="rounded-2xl border border-slate-850/60 bg-slate-950/60 p-3">

                      <span className="block text-slate-300 mb-1">المبلغ</span>

                      <strong className="font-mono text-zinc-100">{invoice.amount} ج.م</strong>

                    </div>

                    <div className="rounded-2xl border border-slate-850/60 bg-slate-950/60 p-3">

                      <span className="block text-slate-300 mb-1">تاريخ الاستحقاق</span>

                      <strong className="font-mono text-zinc-100">{invoice.dueDate}</strong>

                    </div>

                  </div>



                  <InvoiceCountdown dueDateStr={invoice.dueDate} status={invoice.status} />



                  <div className="flex items-center justify-between gap-2 pt-1">

                    {invoice.status !== 'waived' && (

                      <button

                        onClick={() => {

                          setSelectedInvoiceForInstructions(invoice);

                          playTapSound();

                        }}

                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"

                      >

                        <HelpCircle className="w-3.5 h-3.5" />

                        <span>عرض تعليمات السداد</span>

                      </button>

                    )}

                    {invoice.status === 'waived' && (

                      <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black bg-violet-500/10 text-violet-300 border border-violet-500/20">

                        تم الإعفاء من هذا البند

                      </span>

                    )}



                    {invoice.status === 'paid' && (

                      <button

                        onClick={() => {

                          setSelectedInvoiceForPrint(invoice);

                          playTapSound();

                        }}

                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"

                      >

                        <Printer className="w-3.5 h-3.5" />

                        <span>طباعة الإيصال</span>

                      </button>

                    )}

                  </div>

                </motion.div>

              );

            })

          )}

        </AnimatePresence>

      </div>



      <AnimatePresence>

        {selectedInvoiceForInstructions && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            <motion.div

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              exit={{ opacity: 0 }}

              onClick={closeInstructionsDialog}

              className="absolute inset-0 bg-black/60 backdrop-blur-xs"

              aria-hidden="true"

            />



            <motion.div

              ref={instructionsDialogRef}

              initial={{ opacity: 0, scale: 0.95, y: 16 }}

              animate={{ opacity: 1, scale: 1, y: 0 }}

              exit={{ opacity: 0, scale: 0.95, y: 16 }}

              transition={{ type: 'spring', damping: 28, stiffness: 260 }}

              className="bg-slate-900 rounded-[28px] border border-slate-700/30 p-6 z-10 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto select-none font-sans text-right"

              dir="rtl"

              role="dialog"

              aria-modal="true"

              aria-labelledby="payment-instructions-title"

              aria-describedby="payment-instructions-description"

              tabIndex={-1}

            >





              <div className="flex items-center justify-between border-b border-slate-850/50 pb-3">

                <div className="text-right">

                  <h3 id="payment-instructions-title" className="text-sm font-black text-white">تعليمات السداد</h3>

                  <span id="payment-instructions-description" className="text-[10px] text-zinc-300 block mt-0.5">متابعة بند مالي خارج البوابة</span>

                </div>

                <button

                  type="button"

                  onClick={closeInstructionsDialog}

                  className="p-1.5 hover:bg-slate-800 rounded-full text-slate-300 cursor-pointer"

                  aria-label="إغلاق تعليمات السداد"

                >

                  <X className="w-4.5 h-4.5" />

                </button>

              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <div className="p-3.5 rounded-2xl border border-slate-850 bg-slate-950/60 space-y-1">

                  <span className="text-[10px] text-slate-450">البيان</span>

                  <p className="text-sm font-black text-zinc-100">{selectedInvoiceForInstructions.title}</p>

                </div>

                <div className="p-3.5 rounded-2xl border border-slate-850 bg-slate-950/60 space-y-1">

                  <span className="text-[10px] text-slate-450">المبلغ</span>

                  <p className="text-sm font-black text-zinc-100 font-mono">{selectedInvoiceForInstructions.amount} ج.م</p>

                </div>

                <div className="p-3.5 rounded-2xl border border-slate-850 bg-slate-950/60 space-y-1">

                  <span className="text-[10px] text-slate-450">تاريخ الاستحقاق</span>

                  <p className="text-sm font-black text-zinc-100 font-mono">{selectedInvoiceForInstructions.dueDate}</p>

                </div>

              </div>



              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/15 text-amber-200 space-y-2">

                <div className="flex items-center gap-2">

                  <Info className="w-4 h-4 shrink-0" />

                  <span className="text-xs font-black">لا يتم تنفيذ الدفع داخل البوابة</span>

                </div>

                <p className="text-xs leading-relaxed">

                  يمكنك استخدام القنوات التي تعتمدها الإدارة خارج البوابة، وبعد مراجعة السداد سيتم تحديث حالة هذا الطلب داخل الحساب تلقائياً أو من خلال الإدارة.

                </p>

              </div>



              {supportPhone && (

                <a

                  href={`tel:${supportPhone}`}

                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-indigo-500/15 bg-indigo-500/5 text-indigo-300"

                >

                  <div className="text-right">

                    <span className="block text-xs font-black">التواصل مع الإدارة</span>

                    <span className="block text-[11px] font-mono mt-0.5">{supportPhone}</span>

                  </div>

                  <Phone className="w-4.5 h-4.5 shrink-0" />

                </a>

              )}



              {!isOnline && (

                <div className="flex items-center gap-2 p-3 rounded-2xl border border-rose-500/15 bg-rose-500/10 text-rose-300 text-xs">

                  <WifiOff className="w-4 h-4 shrink-0" />

                  <span>الوضع غير المتصل قد يمنع ظهور آخر حالة محدثة حتى يعود الاتصال.</span>

                </div>

              )}

            </motion.div>

          </div>

        )}

      </AnimatePresence>



      <AnimatePresence>

        {selectedInvoiceForPrint && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            <motion.div

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              exit={{ opacity: 0 }}

              onClick={closePrintDialog}

              className="absolute inset-0 bg-black/60 backdrop-blur-xs"

              aria-hidden="true"

            />



            <motion.div

              ref={printDialogRef}

              initial={{ opacity: 0, scale: 0.95, y: 16 }}

              animate={{ opacity: 1, scale: 1, y: 0 }}

              exit={{ opacity: 0, scale: 0.95, y: 16 }}

              transition={{ type: 'spring', damping: 28, stiffness: 260 }}

              className="bg-slate-900 rounded-[28px] border border-slate-700/30 p-6 z-10 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto select-none font-sans text-right"

              dir="rtl"

              role="dialog"

              aria-modal="true"

              aria-labelledby="payment-print-title"

              aria-describedby="payment-print-description"

              tabIndex={-1}

            >





              <div className="flex items-center justify-between border-b border-slate-850/50 pb-3">

                <div className="text-right">

                  <h3 id="payment-print-title" className="text-sm font-black text-white">مراجعة الإيصال</h3>

                  <span id="payment-print-description" className="text-[10px] text-zinc-300 block mt-0.5">تفاصيل السجل المالي المحفوظ</span>

                </div>

                <button

                  type="button"

                  onClick={closePrintDialog}

                  className="p-1.5 hover:bg-slate-800 rounded-full text-slate-300 cursor-pointer"

                  aria-label="إغلاق نافذة الإيصال"

                >

                  <X className="w-4.5 h-4.5" />

                </button>

              </div>



              <div className="rounded-[28px] border border-slate-850/60 bg-slate-950 p-5 space-y-4 shadow-[0_6px_24px_rgba(15,23,42,0.05)]">

                <div className="flex items-center justify-between">

                  <div className="text-right">

                    <h4 className="text-lg font-black text-white">سند السداد</h4>

                    <p className="text-[11px] text-slate-450">إدارة سنتر {centerConfig.centerName}</p>

                  </div>

                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">

                    <Receipt className="w-5 h-5" />

                  </div>

                </div>



                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">

                  <div className="rounded-2xl border border-slate-850 bg-slate-900/50 p-3.5">

                    <span className="flex items-center gap-1.5 text-[10px] text-slate-450 mb-1">

                      <Calendar className="w-3.5 h-3.5" />

                      تاريخ السداد

                    </span>

                    <span className="font-bold font-mono text-zinc-100">{selectedInvoiceForPrint.paidDate || 'غير مسدد'}</span>

                  </div>



                  <div className="rounded-2xl border border-slate-850 bg-slate-900/50 p-3.5">

                    <span className="block text-[10px] text-slate-450 mb-1">الحالة</span>

                    <span className="font-black text-zinc-200">{selectedInvoiceForPrint.title}</span>

                  </div>



                  <div className="rounded-2xl border border-slate-850 bg-slate-900/50 p-3.5">

                    <span className="block text-[10px] text-slate-450 mb-1">الجهة المستلمة</span>

                    <span className="font-black text-zinc-200">إدارة سنتر {centerConfig.centerName}</span>

                  </div>

                </div>



                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">

                  <span className="block text-[11px] text-emerald-250">الطالب المسجل</span>

                  <span className="text-sm font-black text-emerald-400 font-mono">{selectedInvoiceForPrint.amount} ج.م</span>

                </div>

              </div>



              <div className="flex items-center gap-2">

                <button

                  onClick={() => handlePrintReceipt(selectedInvoiceForPrint)}

                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-colors"

                  aria-label="طباعة الإيصال الحالي"

                >

                  <Printer className="w-4 h-4" />

                  <span>طباعة</span>

                </button>

                <button

                  type="button"

                  onClick={closePrintDialog}

                  className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-200 text-sm font-black"

                >

                  إغلاق

                </button>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

    </div>

  );

}

