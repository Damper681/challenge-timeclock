import { useState } from 'react'

const CHALLENGE_USERS = [
  { id: 'jose',     name: 'José',     role: 'mechanic',   label: 'Mécanicien',  space: 'challenge', color: '#4fc3f7' },
  { id: 'vivian',   name: 'Vivian',   role: 'mechanic',   label: 'Mécanicien',  space: 'challenge', color: '#6ee7a0' },
  { id: 'valentin', name: 'Valentin', role: 'carrossier', label: 'Carrossier',  space: 'challenge', color: '#ffb74d' },
  { id: 'marius_c', name: 'Marius',   role: 'mechanic',   label: 'Mécanicien',  space: 'challenge', color: '#f472b6' },
  { id: 'damien_c', name: 'Damien',   role: 'mechanic',   label: 'Mécanicien',  space: 'challenge', color: '#a78bfa' },
]

const GT_USERS = [
  { id: 'marius',  name: 'Marius',  role: 'mechanic', label: 'Mécanicien', space: 'gt', color: '#f472b6' },
  { id: 'damien',  name: 'Damien',  role: 'mechanic', label: 'Mécanicien', space: 'gt', color: '#a78bfa' },
]

const ADMIN_USER = { id: 'admin', name: 'Admin', role: 'admin', label: 'Administration', space: 'all', color: '#e8c547' }

export default function LoginScreen({ onLogin }) {
  const [pressed, setPressed] = useState(null)

  const handleSelect = (u) => {
    setPressed(u.id)
    setTimeout(() => onLogin(u), 180)
  }

  const UserCard = (u) => (
    <button key={u.id} style={{
      ...s.card,
      borderColor: pressed===u.id ? u.color : 'rgba(255,255,255,0.08)',
      background: pressed===u.id ? u.color+'18' : 'rgba(255,255,255,0.03)',
      transform: pressed===u.id ? 'scale(0.96)' : 'scale(1)',
    }} onClick={() => handleSelect(u)}>
      <div style={{...s.avatar, background:u.color+'20', color:u.color}}>{u.name[0]}</div>
      <div style={{...s.name, color:pressed===u.id?u.color:'#f0f0f0'}}>{u.name}</div>
    </button>
  )

  return (
    <div style={s.root}>
      <div style={s.glow} />
      <div style={s.inner}>

        {/* Brand */}
        <div style={s.brand}>
          <div style={s.logo}>CA</div>
          <div>
            <div style={s.brandName}>CHALLENGE</div>
            <div style={s.brandSub}>ATELIER · POINTAGE</div>
          </div>
        </div>

        {/* Challenge Vuisternens */}
        <div style={{...s.siteCard, borderColor:'#4fc3f7'+'30'}}>
          <div style={s.siteHeader}>
            <div style={{...s.siteDot, background:'#4fc3f7'}}/>
            <span style={{...s.siteName, color:'#4fc3f7'}}>Vuisternens</span>
          </div>
          <div style={s.grid5}>
            {CHALLENGE_USERS.map(u => UserCard(u))}
          </div>
        </div>

        {/* Challenge GT Bulle */}
        <div style={{...s.siteCard, borderColor:'#a78bfa'+'30'}}>
          <div style={s.siteHeader}>
            <div style={{...s.siteDot, background:'#a78bfa'}}/>
            <span style={{...s.siteName, color:'#a78bfa'}}>Bulle · GT</span>
          </div>
          <div style={s.grid2}>
            {GT_USERS.map(u => UserCard(u))}
          </div>
        </div>

        {/* Admin */}
        <button style={{
          ...s.adminBtn,
          borderColor: pressed==='admin' ? '#e8c547' : 'rgba(255,255,255,0.06)',
          background: pressed==='admin' ? '#e8c54718' : 'rgba(255,255,255,0.02)',
        }} onClick={() => handleSelect(ADMIN_USER)}>
          <span style={{fontSize:13, color:'#e8c547', fontWeight:700}}>⚙ Admin</span>
        </button>

      </div>
      <div style={s.footer}>Challenge Automobile · v1.0</div>
    </div>
  )
}

const s = {
  root: { minHeight:'100dvh', background:'#080808', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 16px', position:'relative', overflow:'hidden' },
  glow: { position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:500, height:300, background:'radial-gradient(ellipse, rgba(232,197,71,0.06) 0%, transparent 70%)', pointerEvents:'none' },
  inner: { width:'100%', maxWidth:400, display:'flex', flexDirection:'column', gap:10, position:'relative', zIndex:1 },
  brand: { display:'flex', alignItems:'center', gap:14, marginBottom:8, justifyContent:'center' },
  logo: { width:46, height:46, borderRadius:12, background:'#e8c547', color:'#000', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' },
  brandName: { fontWeight:800, fontSize:20, letterSpacing:'0.2em', color:'#f0f0f0', lineHeight:1 },
  brandSub: { fontSize:9, letterSpacing:'0.22em', color:'#555', marginTop:4, fontFamily:'var(--font-mono)' },
  siteCard: { border:'1px solid', borderRadius:14, padding:'12px 12px 14px', background:'rgba(255,255,255,0.01)' },
  siteHeader: { display:'flex', alignItems:'center', gap:7, marginBottom:10 },
  siteDot: { width:7, height:7, borderRadius:'50%', flexShrink:0 },
  siteName: { fontSize:11, fontWeight:700, letterSpacing:'0.14em', fontFamily:'var(--font-mono)' },
  // 5-person grid: 3 top + 2 bottom centered
  grid5: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:7 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 },
  card: { display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 8px 10px', borderRadius:10, border:'1px solid', cursor:'pointer', transition:'all 0.15s ease', gap:6 },
  avatar: { width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700 },
  name: { fontSize:14, fontWeight:700, transition:'color 0.15s' },
  adminBtn: { padding:'12px', borderRadius:12, border:'1px solid', cursor:'pointer', textAlign:'center', transition:'all 0.15s' },
  footer: { position:'fixed', bottom:14, fontSize:10, color:'#222', fontFamily:'var(--font-mono)', letterSpacing:'0.1em' }
}
