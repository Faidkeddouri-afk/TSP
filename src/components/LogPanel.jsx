import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const TYPE_STYLE = {
  info:        { color: '#8899aa' },
  system:      { color: '#00f5ff' },
  improvement: { color: '#00ff88' },
  success:     { color: '#00ff88' },
  warn:        { color: '#ffb700' },
  error:       { color: '#ff3366' },
};

export default function LogPanel({ logs }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <motion.div
      className="card p-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <div className="label-text mb-2 flex items-center gap-2">
        CONSOLE OUTPUT
        <span className="text-green-400 animate-blink text-sm">█</span>
      </div>
      <div
        className="h-28 overflow-y-auto font-mono text-xs leading-5 pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#00f5ff20 transparent' }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-600 italic">awaiting input...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-2 items-start">
              <span className="text-gray-600 flex-shrink-0">[{log.time}]</span>
              <span style={{ color: TYPE_STYLE[log.type]?.color ?? '#8899aa' }}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </motion.div>
  );
}
