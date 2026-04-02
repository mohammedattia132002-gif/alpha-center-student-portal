import React, { useEffect, useState } from 'react';

const SplashScreen: React.FC = () => {
  const [v, setV] = useState(0); // 0=hidden, 1=show, 2=fade-out
  useEffect(() => {
    const t1 = setTimeout(() => setV(1), 80);
    const t2 = setTimeout(() => setV(2), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (v === 0) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #030712 0%, #0a0a1a 50%, #0d0824 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 28,
      fontFamily: "'Cairo', sans-serif",
      opacity: v === 2 ? 0 : 1, transition: 'opacity .65s ease',
    }}>
      {/* Glow orbs */}
      <div style={{
        position: 'absolute', top: '15%', right: '20%',
        width: 260, height: 260, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(109,40,217,.20), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', left: '20%',
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,.13), transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo icon */}
      <div style={{
        width: 96, height: 96, borderRadius: 28,
        background: 'linear-gradient(135deg, #1e3a8a, #4c1d95, #581c87)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 50px rgba(109,40,217,.45), 0 0 0 1px rgba(124,58,237,.30)',
        animation: 'float 4s ease-in-out infinite',
        overflow: 'hidden',
      }}>
        {/* Actual Image Logo */}
        <div style={{ position: 'relative', zIndex: 1, animation: 'scaleIn .65s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <img src="/header-logo.png" style={{ width: 66, height: 66, objectFit: 'contain' }} alt="Alpha Center" />
        </div>
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 32, fontWeight: 900, letterSpacing: '-0.01em',
          background: 'linear-gradient(90deg, #c4b5fd, #818cf8, #38bdf8, #818cf8, #c4b5fd)',
          backgroundSize: '200%',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'shimmer 3s linear infinite',
        }}>
          سنتر الألفا
        </div>
        <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.8)', fontWeight: 600, marginTop: 8, letterSpacing: '.06em' }}>
          بوابة الطالب الذكية
        </div>
      </div>

      {/* Loading bar */}
      <div style={{
        width: 200, height: 3, background: 'rgba(255,255,255,.08)',
        borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,.05)',
      }}>
        <div style={{
          height: '100%', borderRadius: 10,
          background: 'linear-gradient(90deg, #7c3aed, #818cf8, #38bdf8)',
          animation: 'barIn 2.7s cubic-bezier(.4,0,.2,1) forwards',
        }} />
      </div>

      <style>{`
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes barIn   { from{width:0} to{width:100%} }
      `}</style>
    </div>
  );
};

export default SplashScreen;
