﻿import { motion } from 'motion/react'

interface EmptyStateProps {
  icon?: string
  title?: string
  description?: string
}

export default function EmptyState({
  icon = '📭',
  title = 'لا توجد بيانات',
  description = 'ستظهر البيانات هنا بمجرد توفرها.',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center h-full w-full py-6 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="text-3xl opacity-45 select-none mb-2" aria-hidden="true">{icon}</span>
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 select-none">{title}</span>
      <span className="text-[11px] text-slate-500 dark:text-slate-300 mt-1 px-4 leading-relaxed select-none">{description}</span>
    </motion.div>
  )
}
