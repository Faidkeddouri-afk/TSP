import { motion } from 'framer-motion';

const TYPE_COLORS = {
  success: { bg: 'rgba(0,255,136,0.12)', border: '#00ff8840', text: '#00ff88' },
  error:   { bg: 'rgba(255,51,102,0.12)', border: '#ff336640', text: '#ff3366' },
  warn:    { bg: 'rgba(255,183,0,0.12)', border: '#ffb70040', text: '#ffb700' },
  info:    { bg: 'rgba(0,245,255,0.1)', border: '#00f5ff30', text: '#00f5ff' },
};

export default function Toast({ message, type = 'success' }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.info;
  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="px-4 py-3 rounded font-mono text-sm max-w-xs"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, backdropFilter: 'blur(10px)' }}
    >
      {type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : type === 'warn' ? '⚠ ' : '◆ '}
      {message}
    </motion.div>
  );
}
