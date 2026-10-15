import { AnimatePresence, m as motion } from 'motion/react'

/** Text that rolls up when its value changes, for live figures like "2小时前". */
export function RollingText({ children }: { children: string }) {
  return (
    <span className="relative inline-flex overflow-hidden align-bottom">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={children}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
