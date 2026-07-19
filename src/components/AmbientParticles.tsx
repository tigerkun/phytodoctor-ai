import React from 'react';

export default function AmbientParticles({ theme }: { theme: 'day' | 'night' }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="pollen" style={{ left: `${5 + i * 11}%`, top: `${10 + (i % 4) * 20}%`, animationDelay: `${i * 1.2}s`, animationDuration: `${8 + i * 2}s` }} />
      ))}
      {theme === 'day' && (
        <>
          <div className="bird" style={{ top: '12%', animationDelay: '0s' }} />
          <div className="bird" style={{ top: '22%', animationDelay: '8s', animationDuration: '15s', transform: 'scale(0.7)' }} />
        </>
      )}
    </div>
  );
}