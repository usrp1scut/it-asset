// Annual raffle big-screen redesign — replaces the plain Ant Design form Lottery.tsx
// Phases: idle (config) → rolling (animated draw) → reveal (winner spotlight) → history
const { useState, useEffect, useRef } = React;

const PRIZE_TIERS = [
  { id: 'special', label: '特等奖', emoji: '🏆', color: '#FFB31A', glow: 'rgba(255,179,26,0.5)' },
  { id: 'first',   label: '一等奖', emoji: '🥇', color: '#FF8800', glow: 'rgba(255,136,0,0.45)' },
  { id: 'second',  label: '二等奖', emoji: '🥈', color: '#5B92FF', glow: 'rgba(91,146,255,0.45)' },
  { id: 'third',   label: '三等奖', emoji: '🥉', color: '#00B42A', glow: 'rgba(0,180,42,0.4)' },
];

const PRIZE_SKUS = [
  { id: 1, name: 'iPad Pro 11"', code: 'TAB-PRO' },
  { id: 2, name: 'AirPods Pro 2', code: 'HP-APP2' },
  { id: 3, name: '罗技 MX Master 3S', code: 'MS-MX3S' },
  { id: 4, name: '小米充电宝', code: 'PW-MI' },
];

// Eligible pool — active Lark employees (mirror of backend eligible_user_ids)
const POOL = window.USERS;

const CHIP_COLORS = ['#FFB31A', '#FF8800', '#5B92FF', '#7E5EE5', '#00B42A', '#00B2C7', '#F2729B'];

function Confetti({ show }) {
  if (!show) return null;
  const pieces = Array.from({ length: 80 });
  const colors = ['#FFB31A', '#FF8800', '#5B92FF', '#00B42A', '#F2729B', '#7E5EE5', '#fff'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 30 }}>
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const dur = 2.4 + Math.random() * 1.8;
        const size = 6 + Math.random() * 8;
        const c = colors[i % colors.length];
        return (
          <div key={i} style={{
            position: 'absolute', left: `${left}%`, top: 0,
            width: size, height: size * (Math.random() > 0.5 ? 1 : 0.5),
            background: c, borderRadius: Math.random() > 0.6 ? '50%' : 2,
            animation: `confettiFall ${dur}s linear ${delay}s infinite`,
          }} />
        );
      })}
    </div>
  );
}

function LotteryApp() {
  const [phase, setPhase] = useState('idle'); // idle | rolling | reveal
  const [eventName, setEventName] = useState('2026 年会 · 一等奖');
  const [tier, setTier] = useState('first');
  const [count, setCount] = useState(3);
  const [prizeSku, setPrizeSku] = useState(1);
  const [rollNames, setRollNames] = useState([]);
  const [winners, setWinners] = useState([]);
  const [history, setHistory] = useState([
    { id: 3, name: '2026 年会 · 二等奖', tier: 'second', count: 5, prize: 'AirPods Pro 2', winners: ['王芳','刘洋','杨帆','黄磊','马丽'], at: '2026-01-20 20:14' },
    { id: 2, name: '2026 年会 · 三等奖', tier: 'third', count: 8, prize: '小米充电宝', winners: ['张伟','李娜','周明','孙浩','何雪','陈晨','朱琳','胡涛'], at: '2026-01-20 20:02' },
    { id: 1, name: '开门红 · 暖场奖', tier: 'third', count: 2, prize: null, winners: ['吴敏','徐静'], at: '2026-01-20 19:48' },
  ]);
  const rollTimer = useRef(null);

  const tierMeta = PRIZE_TIERS.find(t => t.id === tier);
  const prizeMeta = PRIZE_SKUS.find(s => s.id === prizeSku);
  const alreadyDrawn = history.some(h => h.name === eventName.trim());

  useEffect(() => () => clearInterval(rollTimer.current), []);

  const startDraw = () => {
    if (!eventName.trim() || alreadyDrawn || count < 1) return;
    setPhase('rolling');
    setWinners([]);
    // rolling animation: cycle random names fast
    rollTimer.current = setInterval(() => {
      const picks = [];
      for (let i = 0; i < count; i++) picks.push(POOL[Math.floor(Math.random() * POOL.length)]);
      setRollNames(picks);
    }, 75);

    setTimeout(() => {
      clearInterval(rollTimer.current);
      // final winners — distinct
      const shuffled = [...POOL].sort(() => Math.random() - 0.5).slice(0, count);
      setWinners(shuffled);
      setPhase('reveal');
      setHistory(h => [{
        id: Date.now(), name: eventName.trim(), tier, count,
        prize: prizeMeta?.name || null,
        winners: shuffled.map(w => w.name),
        at: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      }, ...h]);
    }, 3200);
  };

  const reset = () => { setPhase('idle'); setWinners([]); setRollNames([]); };

  return (
    <div className="lottery-root" style={{
      minHeight: '100vh', width: '100%',
      background: 'radial-gradient(ellipse at 50% 0%, #1B2A52 0%, #0C1124 55%, #080B18 100%)',
      color: '#fff', fontFamily: 'var(--font-sans)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: '-15%', left: '20%', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${tierMeta.glow} 0%, transparent 70%)`, filter: 'blur(40px)', animation: 'lotteryGlow 4s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '10%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,146,255,0.25) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

      <Confetti show={phase === 'reveal'} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #3370FF, #5B92FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(51,112,255,0.5)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/><path d="M3 7l9 4 9-4M12 11v10" stroke="#fff" strokeWidth="1.8"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' }}>IT 资产管理 · 年会抽奖</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>奖池来自在职 Lark 员工 · {POOL.length} 人</div>
          </div>
        </div>
        <button onClick={reset} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>返回管理台</button>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: '8px 32px 32px', position: 'relative', zIndex: 10, alignItems: 'flex-start' }}>
        {/* Stage */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tier banner */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 24px', borderRadius: 100,
              background: `linear-gradient(135deg, ${tierMeta.color}33, ${tierMeta.color}11)`,
              border: `1.5px solid ${tierMeta.color}66`,
            }}>
              <span style={{ fontSize: 24 }}>{tierMeta.emoji}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: tierMeta.color, letterSpacing: '0.04em' }}>{eventName || tierMeta.label}</span>
              {prizeMeta && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.1)' }}>奖品 · {prizeMeta.name}</span>}
            </div>
          </div>

          {/* Stage box */}
          <div style={{
            minHeight: 420, borderRadius: 24, position: 'relative',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
            boxShadow: `inset 0 0 80px ${tierMeta.glow}`,
          }}>
            {phase === 'idle' && <IdleStage tierMeta={tierMeta} count={count} />}
            {phase === 'rolling' && <RollingStage names={rollNames} tierMeta={tierMeta} />}
            {phase === 'reveal' && <RevealStage winners={winners} tierMeta={tierMeta} prizeMeta={prizeMeta} />}
          </div>

          {/* Big action button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            {phase === 'reveal' ? (
              <button onClick={reset} style={bigBtn('#3370FF')}>
                ✨ 再抽一轮
              </button>
            ) : (
              <button onClick={startDraw} disabled={phase === 'rolling' || alreadyDrawn || !eventName.trim()}
                style={bigBtn(tierMeta.color, phase === 'rolling' || alreadyDrawn || !eventName.trim())}>
                {phase === 'rolling' ? '🎲 正在抽取…' : '🎲 开 始 抽 奖'}
              </button>
            )}
          </div>
          {alreadyDrawn && phase === 'idle' && (
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#FF8F8F' }}>
              活动「{eventName}」已抽过奖 · 防重抽,请换一个活动名称
            </div>
          )}
        </div>

        {/* Right rail: config + history */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Config card */}
          <div style={glassCard}>
            <div style={cardTitle}>抽奖配置</div>
            <Field label="活动名称(防重抽)">
              <input value={eventName} onChange={e => setEventName(e.target.value)} disabled={phase !== 'idle'}
                placeholder="如 2026 年会一等奖" style={glassInput} />
            </Field>
            <Field label="奖项等级">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PRIZE_TIERS.map(t => (
                  <button key={t.id} onClick={() => phase === 'idle' && setTier(t.id)}
                    style={{
                      padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${tier === t.id ? t.color : 'rgba(255,255,255,0.12)'}`,
                      background: tier === t.id ? `${t.color}22` : 'rgba(255,255,255,0.04)',
                      color: tier === t.id ? t.color : 'rgba(255,255,255,0.7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                    <span>{t.emoji}</span>{t.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`中奖人数(奖池 ${POOL.length} 人)`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
                <button onClick={() => phase === 'idle' && setCount(Math.max(1, count - 1))} style={stepBtn}>−</button>
                <span style={{ minWidth: 48, textAlign: 'center', fontSize: 18, fontWeight: 700 }}>{count}</span>
                <button onClick={() => phase === 'idle' && setCount(Math.min(POOL.length, count + 1))} style={stepBtn}>+</button>
              </div>
            </Field>
            <Field label="关联奖品(库存物品,可选)">
              <select value={prizeSku ?? ''} onChange={e => setPrizeSku(e.target.value ? +e.target.value : null)} disabled={phase !== 'idle'} style={glassInput}>
                <option value="">无</option>
                {PRIZE_SKUS.map(s => <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.name} · {s.code}</option>)}
              </select>
            </Field>
          </div>

          {/* History */}
          <div style={{ ...glassCard, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={cardTitle}>抽奖记录</div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280 }}>
              {history.map(h => {
                const hm = PRIZE_TIERS.find(t => t.id === h.tier) || PRIZE_TIERS[3];
                return (
                  <div key={h.id} style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{hm.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{h.count} 人</span>
                    </div>
                    {h.prize && <div style={{ fontSize: 11, color: hm.color, marginBottom: 4 }}>奖品 · {h.prize}</div>}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{h.winners.join('、')}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{h.at}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdleStage({ tierMeta, count }) {
  return (
    <div style={{ textAlign: 'center', animation: 'lotteryFloat 3s ease-in-out infinite' }}>
      <div style={{ fontSize: 88, marginBottom: 12, filter: `drop-shadow(0 8px 24px ${tierMeta.glow})` }}>{tierMeta.emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 6 }}>准备抽取 {count} 位幸运儿</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>点击下方按钮开始 · 系统级随机,公平公正</div>
    </div>
  );
}

function RollingStage({ names, tierMeta }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
      {names.map((u, i) => (
        <div key={i} style={{
          padding: '20px 28px', borderRadius: 16, minWidth: 140, textAlign: 'center',
          background: `linear-gradient(135deg, ${tierMeta.color}33, ${tierMeta.color}11)`,
          border: `1.5px solid ${tierMeta.color}55`,
          animation: 'rollBlur 0.15s ease-in-out infinite alternate',
        }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>{u?.name || '—'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{window.getDept(u?.dept)?.name || ''}</div>
        </div>
      ))}
    </div>
  );
}

function RevealStage({ winners, tierMeta, prizeMeta }) {
  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: tierMeta.color, marginBottom: 4, letterSpacing: '0.1em' }}>🎉 恭 喜 中 奖 🎉</div>
      {prizeMeta && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>奖品:{prizeMeta.name}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
        {winners.map((u, i) => (
          <div key={u.id} style={{
            padding: '22px 30px', borderRadius: 18, minWidth: 150, textAlign: 'center', position: 'relative',
            background: `linear-gradient(135deg, ${tierMeta.color}, ${tierMeta.color}cc)`,
            boxShadow: `0 12px 36px ${tierMeta.glow}`,
            animation: `winnerPop 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s both`,
          }}>
            <div style={{ position: 'absolute', top: -10, right: -8, fontSize: 24 }}>{tierMeta.emoji}</div>
            <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 10px', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: tierMeta.color }}>{u.avatar}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>{u.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{window.getDept(u.dept)?.name} · {u.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── styled helpers ──
const glassCard = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 18, backdropFilter: 'blur(8px)' };
const cardTitle = { fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'rgba(255,255,255,0.9)' };
const glassInput = { width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)' };
const stepBtn = { width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);
const bigBtn = (color, disabled) => ({
  padding: '16px 56px', borderRadius: 100, fontSize: 20, fontWeight: 800, letterSpacing: '0.08em',
  background: disabled ? 'rgba(255,255,255,0.12)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
  color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : `0 8px 32px ${color}77`,
  transition: 'all 0.2s',
});

ReactDOM.createRoot(document.getElementById('root')).render(<LotteryApp />);
