import { useRef } from 'react';

const BUTTONS = [
  { action: 'special', label: 'ESP', className: 'b-special' },
  { action: 'kick', label: 'PATADA', className: 'b-kick' },
  { action: 'punch', label: 'PUÑO', className: 'b-punch' },
  { action: 'jump', label: 'SALTO', className: 'b-jump' },
];
const MAX = 46, THRESHOLD = 0.35;

// Palanca virtual + botones. Cada toque llama press/release del motor.
export default function TouchPad({ gameRef }) {
  const knobRef = useRef(null);
  const stick = useRef({ id: null, ox: 0, oy: 0 });

  const setDir = (dx, dy) => {
    const g = gameRef.current; if (!g) return;
    const m = Math.hypot(dx, dy), k = m > MAX ? MAX / m : 1;
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const nx = dx / MAX, ny = dy / MAX;
    [['left', nx < -THRESHOLD], ['right', nx > THRESHOLD], ['up', ny < -THRESHOLD], ['down', ny > THRESHOLD]]
      .forEach(([a, on]) => (on ? g.press(a) : g.release(a)));
  };

  const onStickDown = e => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    stick.current = { id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2 };
    setDir(e.clientX - stick.current.ox, e.clientY - stick.current.oy);
  };
  const onStickMove = e => { if (e.pointerId === stick.current.id) setDir(e.clientX - stick.current.ox, e.clientY - stick.current.oy); };
  const onStickUp = e => {
    if (e.pointerId !== stick.current.id) return;
    stick.current.id = null; setDir(0, 0);
    if (knobRef.current) knobRef.current.style.transform = '';
  };

  return (
    <div className="pad">
      <div className="stick" aria-label="Palanca de movimiento"
        onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp}>
        <div className="knob" ref={knobRef} />
      </div>
      <div className="btns">
        {BUTTONS.map(b => (
          <button key={b.action} type="button" className={`pbtn ${b.className}`}
            onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.classList.add('on'); gameRef.current?.press(b.action); }}
            onPointerUp={e => { e.currentTarget.classList.remove('on'); gameRef.current?.release(b.action); }}
            onPointerCancel={e => { e.currentTarget.classList.remove('on'); gameRef.current?.release(b.action); }}
            onLostPointerCapture={e => { e.currentTarget.classList.remove('on'); gameRef.current?.release(b.action); }}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
