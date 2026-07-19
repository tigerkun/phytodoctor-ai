import React from 'react';

export default function VaultParticles() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="spore" style={{ 
          left: `${5 + i * 9}%`, 
          top: `${5 + (i % 5) * 18}%`, 
          animationDelay: `${i * 1.5}s`,
          animationDuration: `${10 + i * 2}s`
        }} />
      ))}
    </div>
  );
}