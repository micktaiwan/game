import React, { useEffect, useState } from 'react';

function formatTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function Notifications({ messages, onDismiss, fadeMs = 60000 }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100); // ~10 fps fade
    return () => clearInterval(id);
  }, []);
  // Auto-dismiss messages when they exceed fadeMs
  useEffect(() => {
    if (!onDismiss) return;
    const now = Date.now();
    const timers = messages
      .filter((m) => !m.closing)
      .map((m) => {
        const remaining = Math.max(0, fadeMs - (now - m.ts.getTime()));
        const id = setTimeout(() => onDismiss && onDismiss(m.id), remaining);
        return id;
      });
    return () => timers.forEach(clearTimeout);
  }, [messages, fadeMs, onDismiss]);
  // Keep additional hooks AFTER the effect to avoid HMR hook-order warnings
  const [hoveredId, setHoveredId] = useState(null);

  function computeAlpha(ts) {
    const age = Date.now() - ts.getTime();
    const t = Math.min(1, Math.max(0, age / fadeMs));
    const eased = Math.pow(1 - t, 2.2); // ease-out
    const min = 0; // fully disappear by the end
    return Math.max(min, eased);
  }
  return (
    <div style={{
      position: 'fixed',
      left: 10,
      bottom: 10,
      zIndex: 20,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      gap: 8,
      width: 420,
      minHeight: 0
    }}>
      {messages.map((m) => {
        const isHovered = hoveredId === m.id;
        const alpha = isHovered ? 1 : computeAlpha(m.ts);
        const bg = m.level === 'danger'
          ? `rgba(146,0,0,${0.2 * alpha})`
          : m.level === 'success'
          ? `rgba(0,146,88,${0.2 * alpha})`
          : `rgba(14,20,27,${0.7 * alpha})`;
        const border = m.level === 'danger' ? '#ff6b6b' : m.level === 'success' ? '#32d296' : '#e6edf3';
        const textOpacity = 0.85 * alpha + 0.15; // keep readable
        const timeOpacity = 0.6 * alpha + 0.2;
        const isClosing = !!m.closing;
        const scale = isClosing ? 0.98 : 1;
        const closeOpacity = isClosing ? 0 : 1;
        return (
          <div
            key={m.id}
            style={{
              pointerEvents: 'auto',
              background: bg,
              border: `1px solid ${border}`,
              color: '#e6edf3',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              boxSizing: 'border-box',
              transform: `scale(${scale})`,
              opacity: isClosing ? 0 : 1,
              transition: 'opacity 300ms ease, transform 300ms ease'
            }}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId((id) => (id === m.id ? null : id))}
          >
            <span style={{ opacity: timeOpacity, fontFamily: 'monospace' }}>{formatTime(m.ts)}</span>
            <span style={{ opacity: textOpacity, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{m.text}</span>
            <button
              onClick={() => onDismiss && onDismiss(m.id)}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: '#e6edf3',
                opacity: 0.6,
                cursor: 'pointer'
              }}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}


