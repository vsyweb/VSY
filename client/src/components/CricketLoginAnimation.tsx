import React, { useEffect, useState, useRef } from 'react';

interface Props {
  onComplete: () => void;
  brandName?: string;
}

/* ─── Particle shape ─────────────────────────────────────────────────────── */
interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  life: number;
}

/* ─── Phase timeline ─────────────────────────────────────────────────────── */
//  0 → black screen                (0 ms)
//  1 → turf grid fades in          (200 ms)
//  2 → ball hurls across screen    (700 ms)
//  3 → bat swings & impact         (1,600 ms)
//  4 → shockwave + particles       (1,850 ms)
//  5 → logo & brand reveal         (2,300 ms)
//  6 → "Welcome" sub-line          (3,000 ms)
//  7 → exit fade-out               (4,200 ms)
//  → onComplete called             (4,800 ms)

const COLORS = ['#22c55e', '#16a34a', '#4ade80', '#ffffff', '#86efac', '#ffd700'];

const CricketLoginAnimation: React.FC<Props> = ({
  onComplete,
  brandName = 'VSY BOX CRICKET',
}) => {
  const [phase, setPhase] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleRef = useRef<number | null>(null);
  const nextId = useRef(0);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  /* ── phase timer ── */
  useEffect(() => {
    const schedule = [
      [1, 200],
      [2, 700],
      [3, 1600],
      [4, 1850],
      [5, 2300],
      [6, 3000],
      [7, 4200],
    ] as const;

    const handles = schedule.map(([p, t]) => setTimeout(() => setPhase(p), t));
    const done = setTimeout(() => {
      onCompleteRef.current();
    }, 4800);
    return () => {
      handles.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, []);

  /* ── particle burst at impact ── */
  useEffect(() => {
    if (phase !== 4) return;

    const burst: Particle[] = Array.from({ length: 40 }).map((_, i) => ({
      id: nextId.current++,
      x: 50,
      y: 50,
      angle: (i / 40) * 360,
      speed: 2 + Math.random() * 5,
      size: 4 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
    }));
    setParticles(burst);

    const tick = () => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + Math.cos((p.angle * Math.PI) / 180) * p.speed * 0.6,
            y: p.y + Math.sin((p.angle * Math.PI) / 180) * p.speed * 0.6,
            life: p.life - 0.025,
            size: p.size * 0.97,
          }))
          .filter(p => p.life > 0)
      );
      particleRef.current = requestAnimationFrame(tick);
    };
    particleRef.current = requestAnimationFrame(tick);
    return () => {
      if (particleRef.current) cancelAnimationFrame(particleRef.current);
    };
  }, [phase]);

  /* ── brand name letter-split ── */
  const letters = brandName.split('');

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{
        background: '#050808',
        transition: phase >= 7 ? 'opacity 0.6s ease-in' : undefined,
        opacity: phase >= 7 ? 0 : 1,
        pointerEvents: phase >= 7 ? 'none' : 'all',
      }}
    >
      {/* ══════════════ TURF GRID BACKGROUND ══════════════ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: phase >= 1 ? 0.18 : 0,
          transition: 'opacity 1.2s ease-out',
          backgroundImage: `
            linear-gradient(rgba(34,197,94,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,197,94,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ══════════════ RADIAL GLOW CENTER ══════════════ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 55% at 50% 50%, rgba(21,128,61,0.25) 0%, transparent 70%)',
          opacity: phase >= 3 ? 1 : 0,
          transition: 'opacity 1s ease-out',
        }}
      />

      {/* ══════════════ PARTICLE CANVAS ══════════════ */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            opacity: p.life,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ══════════════ SHOCKWAVE RING ══════════════ */}
      {phase >= 4 && (
        <>
          <div style={shockwaveStyle(0)} />
          <div style={shockwaveStyle(0.15)} />
          <div style={shockwaveStyle(0.3)} />
        </>
      )}

      {/* ══════════════ CRICKET SCENE (SVG) ══════════════ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: phase >= 5 ? 0 : 1,
          transition: 'opacity 0.4s ease-in',
        }}
      >
        <svg
          viewBox="0 0 500 300"
          style={{ width: '90vw', maxWidth: 560, overflow: 'visible' }}
        >
          {/* ── Ball path: phase 2 hurls from right, phase 3 hit ── */}
          <g
            style={{
              transform:
                phase === 0 ? 'translate(540px, 150px)' :
                phase === 1 ? 'translate(540px, 145px)' :
                phase === 2 ? 'translate(255px, 148px)' :
                phase >= 3 ? 'translate(-60px, -50px)' : '',
              transition:
                phase === 2 ? 'transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94)' :
                phase === 3 ? 'transform 0.25s cubic-bezier(0.55,0,1,0.45)' : 'none',
            }}
          >
            {/* Ball glow */}
            <circle cx={0} cy={0} r={18} fill="rgba(239,68,68,0.25)" />
            {/* Ball body */}
            <circle cx={0} cy={0} r={13} fill="#dc2626" />
            {/* Seam lines */}
            <path
              d="M-8,-6 Q0,-13 8,-6"
              stroke="#7f1d1d"
              strokeWidth={1.8}
              fill="none"
            />
            <path
              d="M-8,6 Q0,13 8,6"
              stroke="#7f1d1d"
              strokeWidth={1.8}
              fill="none"
            />
            <path
              d="M0,-13 Q6,0 0,13"
              stroke="#7f1d1d"
              strokeWidth={1.2}
              fill="none"
            />
            {/* Shine */}
            <ellipse cx={-4} cy={-5} rx={3} ry={2} fill="rgba(255,255,255,0.35)" />
          </g>

          {/* ── Bat: swings in at phase 3 ── */}
          <g
            style={{
              transformOrigin: '220px 260px',
              transform:
                phase < 2  ? 'rotate(65deg) translate(0px, 80px) scale(0.7)' :
                phase === 2 ? 'rotate(40deg) translate(0px, 0px) scale(1)' :
                phase === 3 ? 'rotate(-30deg) scale(1.05)' :
                phase >= 4  ? 'rotate(-80deg) translate(-40px, 40px) scale(0.8)' : '',
              transition:
                phase === 2 ? 'transform 0.9s cubic-bezier(0.34,1.56,0.64,1)' :
                phase === 3 ? 'transform 0.18s cubic-bezier(0.55,0,1,0.45)' :
                phase >= 4  ? 'transform 0.5s ease-in' : 'none',
              opacity: phase >= 1 ? 1 : 0,
            }}
          >
            {/* Bat handle */}
            <rect x={215} y={155} width={10} height={56} rx={4}
              fill="#d1d5db" />
            <rect x={217} y={155} width={3} height={56} rx={3}
              fill="rgba(255,255,255,0.2)" />
            {/* Grip wrap */}
            {[0,8,16,24,32,40,48].map((y, i) => (
              <line
                key={i}
                x1={215} y1={160 + y}
                x2={225} y2={160 + y}
                stroke={i % 2 === 0 ? '#6b7280' : '#9ca3af'}
                strokeWidth={1.5}
              />
            ))}
            {/* Bat blade */}
            <rect x={204} y={211} width={32} height={82} rx={6}
              fill="#b45309" />
            {/* Blade face grain */}
            <rect x={209} y={215} width={22} height={74} rx={4}
              fill="#d97706" />
            {/* Blade sweet spot highlight */}
            <ellipse cx={220} cy={255} rx={7} ry={18}
              fill="rgba(254,243,199,0.25)" />
            {/* Toe */}
            <rect x={204} y={287} width={32} height={6} rx={6}
              fill="#92400e" />
          </g>
        </svg>
      </div>

      {/* ══════════════ IMPACT FLASH ══════════════ */}
      {phase === 3 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.18)',
            animation: 'vsyFlash 0.25s ease-out forwards',
          }}
        />
      )}

      {/* ══════════════ LOGO & BRAND REVEAL ══════════════ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          opacity: phase >= 5 ? 1 : 0,
          transform: phase >= 5 ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(30px)',
          transition: 'opacity 0.7s ease-out, transform 0.7s cubic-bezier(0.34,1.4,0.64,1)',
        }}
      >
        {/* Glow rings behind logo */}
        <div style={{ position: 'relative', marginBottom: 28 }}>
          <div style={glowRing(160, 'rgba(34,197,94,0.08)', phase >= 5)} />
          <div style={glowRing(120, 'rgba(34,197,94,0.12)', phase >= 5)} />
          <div style={glowRing(90, 'rgba(34,197,94,0.18)', phase >= 5)} />

          {/* Logo image */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              width: 128,
              height: 128,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
          >
            <img
              src="/images/logo.png"
              alt="VSY Logo"
              style={{
                width: 110,
                height: 110,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 20px rgba(34,197,94,0.6))',
                animation: phase >= 5 ? 'vsyLogoFloat 3s ease-in-out infinite' : 'none',
              }}
            />
          </div>
        </div>

        {/* Brand name letter-by-letter */}
        <h1
          style={{
            fontSize: 'clamp(1.6rem, 5vw, 3rem)',
            fontWeight: 900,
            letterSpacing: '0.15em',
            color: '#fff',
            display: 'flex',
            gap: '0.04em',
            textShadow: '0 0 40px rgba(34,197,94,0.5)',
          }}
        >
          {letters.map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: phase >= 5 ? 1 : 0,
                transform: phase >= 5 ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.4s ease ${0.05 * i + 0.1}s, transform 0.4s ease ${0.05 * i + 0.1}s`,
                color: ch === ' ' ? 'transparent' : '#ffffff',
                minWidth: ch === ' ' ? '0.4em' : undefined,
              }}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </h1>

        {/* Divider line */}
        <div
          style={{
            width: phase >= 6 ? 200 : 0,
            height: 1.5,
            background:
              'linear-gradient(90deg, transparent, #22c55e, transparent)',
            marginTop: 14,
            marginBottom: 14,
            transition: 'width 0.7s cubic-bezier(0.34,1.3,0.64,1) 0.1s',
          }}
        />

        {/* Sub-line */}
        <p
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: '#4ade80',
            fontWeight: 700,
            opacity: phase >= 6 ? 1 : 0,
            transform: phase >= 6 ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s',
          }}
        >
          Welcome To The Arena
        </p>
      </div>

      {/* ══════════════ KEYFRAME DEFINITIONS ══════════════ */}
      <style>{`
        @keyframes vsyFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes vsyShockwave {
          0%   { transform: translate(-50%, -50%) scale(0);   opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; }
        }
        @keyframes vsyLogoFloat {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-8px); }
        }
        @keyframes vsyRingPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);   opacity: 0.4; }
          50%       { transform: translate(-50%, -50%) scale(1.06); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function shockwaveStyle(delay: number): React.CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 120,
    height: 120,
    borderRadius: '50%',
    border: '2px solid rgba(34,197,94,0.7)',
    animation: `vsyShockwave 0.9s cubic-bezier(0.2,0.6,0.4,1) ${delay}s forwards`,
    pointerEvents: 'none',
  };
}

function glowRing(size: number, color: string, active: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: size,
    height: size,
    borderRadius: '50%',
    background: color,
    animation: active ? 'vsyRingPulse 2.5s ease-in-out infinite' : 'none',
    pointerEvents: 'none',
  };
}

export default CricketLoginAnimation;
