// src/App.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { Login, Register, WorkspaceSetup } from './Auth'
import TeamSettings from './TeamSettings'
import Pipeline from './Pipeline'
import ActivityLog, { ActivityForm } from './ActivityLog'
import { usePermissions, canAccessTeamSettings, isLockedRole } from './permissions'
import { useTranslation, LANGUAGES } from './i18n'

// ─── Constants ───────────────────────────────────────────────
const STAGE_COLS   = ['Discovery','Qualified','Proposal','Negotiation','Closed Won']
const STATUS_OPTS  = ['Lead','Prospect','Customer','Churned']
const STAGE_COLORS = { 'Closed Won':['#d4edda','#155724'], Negotiation:['#fce4ec','#c62828'], Proposal:['#fff8e1','#f57f17'], Qualified:['#e3f2fd','#1565c0'], Discovery:['#e8eaf6','#3949ab'] }
const STATUS_COLORS = { Lead:['#fff3cd','#856404'], Prospect:['#d1ecf1','#0c5460'], Customer:['#d4edda','#155724'], Churned:['#f8d7da','#721c24'] }
const ACT_ICONS    = { call:'📞', email:'✉️', meeting:'📅', note:'📝' }

const fmt$  = v => '$' + Number(v||0).toLocaleString()
const initials = name => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
const timeAgo = iso => {
  const s = Math.floor((Date.now() - new Date(iso))/1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s/60)+'m ago'
  if (s < 86400) return Math.floor(s/3600)+'h ago'
  return Math.floor(s/86400)+'d ago'
}

// ─── UI Atoms ────────────────────────────────────────────────
const Pill = ({ label, map }) => {
  const [bg, color] = map[label] || ['#eee','#555']
  return <span style={{display:'inline-flex',alignItems:'center',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:'0.03em',background:bg,color}}>{label}</span>
}

const Field = ({ label, children }) => (
  <div style={{marginBottom:14}}>
    <label style={{display:'block',fontSize:11,fontWeight:700,color:'#888',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</label>
    {children}
  </div>
)

const Inp = (props) => <input className="inp" {...props} />
const Sel = ({children,...p}) => <select className="inp" {...p}>{children}</select>
const Tex = (props) => <textarea className="inp" rows={3} style={{resize:'vertical'}} {...props} />

const Toast = ({ msg }) => msg ? (
  <div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:'#1a1a1a',color:'#fff',padding:'10px 22px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:9999,pointerEvents:'none',animation:'popIn 0.2s ease'}}>{msg}</div>
) : null

const Spinner = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12}}>
    <div style={{width:40,height:40,border:'3px solid #f0ede8',borderTop:'3px solid #ff7a59',borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />
    <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:18,color:'#ff7a59'}}>Connecting to database…</span>
  </div>
)

// ─── Modal Shell ─────────────────────────────────────────────
const Modal = ({ title, onClose, children, width=480 }) => (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
    <div style={{background:'#fff',borderRadius:16,width,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.18)',animation:'popIn 0.18s ease'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #f0ede8'}}>
        <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:18}}>{title}</span>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#aaa'}}>✕</button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>
)

// ─── Contact Form ─────────────────────────────────────────────
const ContactForm = ({ initial, onSave, onClose, saving }) => {
  const [f,setF] = useState(initial || {name:'',company:'',email:'',phone:'',status:'Lead',stage:'Discovery',value:0,notes:''})
  const set = k => e => setF(p=>({...p,[k]:e.target.value}))
  return (
    <Modal title={initial?.id ? 'Edit Contact' : 'New Contact'} onClose={onClose}>
      <Field label="Full Name"><Inp value={f.name} onChange={set('name')} placeholder="Jane Smith" /></Field>
      <Field label="Company"><Inp value={f.company} onChange={set('company')} placeholder="Acme Corp" /></Field>
      <Field label="Email"><Inp type="email" value={f.email} onChange={set('email')} placeholder="jane@acme.com" /></Field>
      <Field label="Phone"><Inp value={f.phone} onChange={set('phone')} placeholder="+1 555-0100" /></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="Status"><Sel value={f.status} onChange={set('status')}>{STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</Sel></Field>
        <Field label="Stage"><Sel value={f.stage} onChange={set('stage')}>{STAGE_COLS.map(s=><option key={s}>{s}</option>)}</Sel></Field>
      </div>
      <Field label="Estimated Value ($)"><Inp type="number" value={f.value} onChange={set('value')} /></Field>
      <Field label="Notes"><Tex value={f.notes} onChange={set('notes')} /></Field>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={saving||!f.name} onClick={()=>onSave(f)}>{saving?'Saving…':'Save Contact'}</button>
      </div>
    </Modal>
  )
}

// ─── Deal Form ────────────────────────────────────────────────
const DealForm = ({ initial, contacts, stages, onSave, onClose, saving }) => {
  const defaultStage = stages.find(s => s.is_default) || stages[0]
  const [f,setF] = useState(initial || {name:'',contact_id:contacts[0]?.id||'',value:0,stage_id:defaultStage?.id||'',stage:defaultStage?.name||'',probability:20,close_date:'',notes:''})
  const set = k => e => setF(p=>({...p,[k]:e.target.value}))
  const sortedStages = [...stages].sort((a,b) => a.position - b.position)
  return (
    <Modal title={initial?.id ? 'Edit Deal' : 'New Deal'} onClose={onClose}>
      <Field label="Deal Name"><Inp value={f.name} onChange={set('name')} placeholder="Enterprise License – Acme" /></Field>
      <Field label="Contact">
        <Sel value={f.contact_id} onChange={set('contact_id')}>
          <option value="">— No contact —</option>
          {contacts.map(c=><option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
        </Sel>
      </Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="Value ($)"><Inp type="number" value={f.value} onChange={set('value')} /></Field>
        <Field label="Probability (%)"><Inp type="number" min={0} max={100} value={f.probability} onChange={set('probability')} /></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="Stage">
          <Sel value={f.stage_id || f.stage} onChange={e => {
            const s = sortedStages.find(st => st.id === e.target.value)
            setF(p => ({...p, stage_id: s?.id || '', stage: s?.name || e.target.value}))
          }}>
            {sortedStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Sel>
        </Field>
        <Field label="Close Date"><Inp type="date" value={f.close_date} onChange={set('close_date')} /></Field>
      </div>
      <Field label="Notes"><Tex value={f.notes} onChange={set('notes')} /></Field>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={saving||!f.name} onClick={()=>onSave(f)}>{saving?'Saving…':'Save Deal'}</button>
      </div>
    </Modal>
  )
}

// ─── Contact Detail Panel ──────────────────────────────────────
const ContactPanel = ({ contact, deals, activities, onEdit, onDelete, onClose }) => {
  const cDeals = deals.filter(d=>d.contact_id===contact.id)
  const cActs  = [...activities.filter(a=>a.contact_id===contact.id)].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.25)',zIndex:150,display:'flex',justifyContent:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:420,background:'#fff',height:'100vh',overflowY:'auto',borderLeft:'1px solid #e8e5e0',animation:'slideIn 0.2s ease'}}>
        <div style={{padding:24,borderBottom:'1px solid #f0ede8'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{display:'flex',gap:14,alignItems:'center'}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'#ff7a59',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16}}>{contact.avatar||initials(contact.name)}</div>
              <div>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:20}}>{contact.name}</div>
                <div style={{fontSize:13,color:'#888'}}>{contact.company}</div>
                <div style={{marginTop:6}}><Pill label={contact.status} map={STATUS_COLORS}/></div>
              </div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#aaa'}}>✕</button>
          </div>
          <div style={{display:'flex',gap:8,marginTop:16}}>
            <button className="btn-primary" style={{fontSize:12}} onClick={onEdit}>✏ Edit</button>
            <button className="btn-ghost" style={{fontSize:12,color:'#c62828'}} onClick={onDelete}>🗑 Delete</button>
          </div>
        </div>
        <div style={{padding:24}}>
          <h4 style={{fontSize:11,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12}}>Contact Info</h4>
          {[['Email',contact.email],['Phone',contact.phone||'—'],['Stage',contact.stage],['Value',fmt$(contact.value)],['Added',timeAgo(contact.created_at)]].map(([l,v])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #f5f5f0'}}>
              <span style={{fontSize:13,color:'#888'}}>{l}</span>
              <span style={{fontSize:13,fontWeight:600}}>{v}</span>
            </div>
          ))}
          {contact.notes && <div style={{marginTop:12,padding:12,background:'#fafaf8',borderRadius:8,fontSize:13,color:'#555',lineHeight:1.5}}>{contact.notes}</div>}

          {cDeals.length > 0 && <>
            <h4 style={{fontSize:11,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:24,marginBottom:12}}>Deals ({cDeals.length})</h4>
            {cDeals.map(d=>(
              <div key={d.id} style={{background:'#f5f5f0',borderRadius:10,padding:12,marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:13}}>{d.name}</div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                  <Pill label={d.stage} map={STAGE_COLORS}/>
                  <span style={{fontWeight:800,color:'#ff7a59',fontFamily:'Syne,sans-serif'}}>{fmt$(d.value)}</span>
                </div>
              </div>
            ))}
          </>}

          {cActs.length > 0 && <>
            <h4 style={{fontSize:11,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:24,marginBottom:12}}>Timeline</h4>
            {cActs.slice(0,8).map(a=>(
              <div key={a.id} style={{display:'flex',gap:12,paddingBottom:12}}>
                <div style={{width:28,height:28,borderRadius:8,background:'#fff8f6',border:'1px solid #fce0d8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{ACT_ICONS[a.type]||'⚡'}</div>
                <div><div style={{fontSize:13}}>{a.text}</div><div style={{fontSize:11,color:'#aaa',marginTop:2}}>{timeAgo(a.created_at)}</div></div>
              </div>
            ))}
          </>}
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const { t, lang, setLang, LANGUAGES } = useTranslation()
  const [langOpen, setLangOpen] = useState(false)

  // ── Auth + Workspace state ─────────────────────────────────
  const [authScreen,  setAuthScreen]  = useState('login')   // 'login' | 'register'
  const [user,        setUser]        = useState(null)
  const [workspace,   setWorkspace]   = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── CRM state ──────────────────────────────────────────────
  const [contacts,   setContacts]   = useState([])
  const [deals,      setDeals]      = useState([])
  const [activities, setActivities] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [nav,        setNav]        = useState('dashboard')
  const [search,     setSearch]     = useState('')
  const [modal,      setModal]      = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [selected,   setSelected]   = useState(null)
  const [sidebar,    setSidebar]    = useState(true)
  const [toast,      setToast]      = useState(null)
  const [stages,     setStages]     = useState([])
  const [dbError,    setDbError]    = useState(null)
  const [teamOpen,   setTeamOpen]   = useState(false)
  const [followUpParent, setFollowUpParent] = useState(null) // activity that triggered a follow-up log

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(null),2600) }

  // ── Listen to auth state ───────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) { setWorkspace(null); setContacts([]); setDeals([]); setActivities([]) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load workspace for logged-in user ──────────────────────
  useEffect(() => {
    if (!user) return
    supabase.from('workspace_members')
      .select('workspace_id, role, workspaces(id, name, slug)')
      .eq('user_id', user.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.workspaces) setWorkspace(data.workspaces)
      })
  }, [user])

  // ── Fetch all data scoped to workspace ─────────────────────
  const fetchAll = useCallback(async (wsId) => {
    if (!wsId) return
    setLoading(true)
    try {
      const [{ data: c }, { data: d }, { data: st }, { data: a }] = await Promise.all([
        supabase.from('contacts').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
        supabase.from('deals').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
        supabase.from('deal_stages').select('*').eq('workspace_id', wsId).order('position'),
        supabase.from('activities').select('*').eq('workspace_id', wsId).order('activity_at', { ascending: false }),
      ])
      setContacts(c || [])
      setDeals(d || [])
      setStages(st || [])
      setActivities(a || [])
    } catch (err) {
      setDbError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (workspace) fetchAll(workspace.id) }, [workspace, fetchAll])

  // ── Load permissions from DB via hook ─────────────────────
  const { userCan, roleName: userRoleName } = usePermissions(workspace, user)

  // ── Real-time subscriptions ────────────────────────────────
  useEffect(() => {
    if (!workspace) return
    const contactSub = supabase.channel('contacts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchAll(workspace.id))
      .subscribe()
    const dealSub = supabase.channel('deals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => fetchAll(workspace.id))
      .subscribe()
    const actSub = supabase.channel('activities-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => fetchAll(workspace.id))
      .subscribe()
    const stageSub = supabase.channel('stages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_stages' }, () => fetchAll(workspace.id))
      .subscribe()
    return () => { contactSub.unsubscribe(); dealSub.unsubscribe(); actSub.unsubscribe(); stageSub.unsubscribe() }
  }, [workspace, fetchAll])

  // ── CRUD: Contacts ─────────────────────────────────────────
  const saveContact = async (data) => {
    setSaving(true)
    const payload = { ...data, value: Number(data.value), avatar: initials(data.name), workspace_id: workspace.id }
    const { error } = editTarget?.id
      ? await supabase.from('contacts').update(payload).eq('id', editTarget.id)
      : await supabase.from('contacts').insert(payload)
    setSaving(false)
    if (error) return showToast('Error: ' + error.message)
    await fetchAll(workspace.id)
    setModal(null); setEditTarget(null); setSelected(null)
    showToast(editTarget?.id ? 'Contact updated ✓' : 'Contact added ✓')
  }

  const deleteContact = async (id) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) return showToast('Error: ' + error.message)
    await fetchAll(workspace.id)
    setSelected(null)
    showToast(t('contacts.deleted'))
  }

  // ── CRUD: Deals ────────────────────────────────────────────
  const saveDeal = async (data) => {
    setSaving(true)
    const payload = { ...data, value: Number(data.value), probability: Number(data.probability), contact_id: data.contact_id || null, close_date: data.close_date || null, workspace_id: workspace.id }
    const { error } = editTarget?.id
      ? await supabase.from('deals').update(payload).eq('id', editTarget.id)
      : await supabase.from('deals').insert(payload)
    setSaving(false)
    if (error) return showToast('Error: ' + error.message)
    await fetchAll(workspace.id)
    setModal(null); setEditTarget(null)
    showToast(editTarget?.id ? 'Deal updated ✓' : 'Deal added ✓')
  }

  const deleteDeal = async (id) => {
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) return showToast('Error: ' + error.message)
    await fetchAll(workspace.id)
    showToast(t('deals.deleted'))
  }

  // ── CRUD: Activities ────────────────────────────────────────
  const saveActivity = async (data) => {
    setSaving(true)
    const payload = {
      workspace_id:      workspace.id,
      created_by:        user.id,
      type:              data.type,
      text:              data.text,
      contact_id:        data.contact_id || null,
      deal_id:           data.deal_id || null,
      activity_at:       data.activity_at || new Date().toISOString(),
      duration_mins:     data.duration_mins ? parseInt(data.duration_mins) : null,
      notes:             data.notes || null,
      follow_up_action:  data.follow_up_action || null,
      follow_up_date:    data.follow_up_date || null,
      follow_up_done:    false,
      // Link to parent activity if this is a follow-up
      parent_activity_id: followUpParent?.id || null,
    }
    const { error } = await supabase.from('activities').insert(payload)
    if (error) { setSaving(false); return showToast('Error: ' + error.message) }
    // If this was a follow-up, mark the parent as done
    if (followUpParent?.id) {
      await supabase.from('activities').update({ follow_up_done: true }).eq('id', followUpParent.id)
    }
    setSaving(false)
    setModal(null)
    setFollowUpParent(null)
    await fetchAll(workspace.id)
    showToast(t('actForm.title') + ' ✓')
  }

  // ── Auth gates ─────────────────────────────────────────────
  if (authLoading) return <Spinner />
  if (!user) return authScreen === 'login'
    ? <Login onSwitch={setAuthScreen} />
    : <Register onSwitch={setAuthScreen} />
  if (!workspace) return <WorkspaceSetup user={user} onDone={setWorkspace} />

  // ── Metrics ────────────────────────────────────────────────
  const pipeline = deals.reduce((s,d)=>s+Number(d.value),0)
  const won      = deals.filter(d=>d.stage==='Closed Won').reduce((s,d)=>s+Number(d.value),0)
  const openDeals = deals.filter(d=>d.stage!=='Closed Won').length
  const winRate  = deals.length ? Math.round(deals.filter(d=>d.stage==='Closed Won').length/deals.length*100) : 0

  const filtContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company||'').toLowerCase().includes(search.toLowerCase()) ||
    (c.email||'').toLowerCase().includes(search.toLowerCase())
  )
  const filtDeals = deals.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  const navItems = [
    { id:'dashboard', label: t('nav.dashboard'), icon:'◈' },
    { id:'contacts',  label: t('nav.contacts'),  icon:'👤' },
    { id:'deals',     label: t('nav.deals'),     icon:'💼' },
    { id:'pipeline',  label: t('nav.pipeline'),  icon:'⟶' },
    { id:'activity',  label: t('nav.activity'),  icon:'⚡' },
  ]

  if (loading) return <Spinner />

  if (dbError) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16,padding:32,fontFamily:'DM Sans,sans-serif'}}>
      <div style={{fontSize:48}}>⚠️</div>
      <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:800,color:'#c62828'}}>Database Connection Failed</h2>
      <p style={{color:'#666',maxWidth:480,textAlign:'center',lineHeight:1.6}}>{dbError}</p>
      <p style={{color:'#888',fontSize:13}}>Open <code style={{background:'#f5f5f0',padding:'2px 6px',borderRadius:4}}>src/supabaseClient.js</code> and replace the URL and anon key with your Supabase project's values.</p>
      <button className="btn-primary" onClick={()=>{setDbError(null);setLoading(true);fetchAll()}}>Retry Connection</button>
    </div>
  )

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",display:'flex',height:'100vh',background:'#f5f5f0',overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#d4d4cc;border-radius:3px}
        .nav-item{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;color:#6b6b6b;transition:all 0.15s;border:none;background:transparent;width:100%;text-align:left;font-family:inherit}
        .nav-item:hover{background:#f0ede8;color:#1a1a1a}.nav-item.active{background:#ff7a59;color:#fff}
        .card{background:#fff;border-radius:12px;border:1px solid #e8e5e0}
        .btn-primary{background:#ff7a59;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s;font-family:inherit}
        .btn-primary:hover{background:#e8633d}.btn-primary:disabled{opacity:0.55;cursor:not-allowed}
        .btn-ghost{background:transparent;border:1px solid #e0ddd8;color:#444;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;font-family:inherit}
        .btn-ghost:hover{background:#f5f5f0}
        .inp{border:1px solid #e0ddd8;border-radius:8px;padding:9px 14px;font-size:13px;font-family:inherit;background:#fff;color:#1a1a1a;outline:none;transition:border-color 0.15s;width:100%}
        .inp:focus{border-color:#ff7a59}
        .row{display:grid;align-items:center;padding:13px 20px;border-bottom:1px solid #f0ede8;cursor:pointer;transition:background 0.1s}
        .row:hover{background:#fafaf8}
        .progress-bar{height:4px;background:#f0ede8;border-radius:2px;overflow:hidden;margin-top:6px}
        .progress-fill{height:100%;background:#ff7a59;border-radius:2px}
        @keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes popIn{from{transform:scale(0.94);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes fadeUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Sidebar */}
      <div style={{width:sidebar?220:62,background:'#fff',borderRight:'1px solid #e8e5e0',display:'flex',flexDirection:'column',transition:'width 0.2s',overflow:'hidden',flexShrink:0}}>
        <div style={{padding:'20px 14px 16px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid #f0ede8'}}>
          <div style={{width:34,height:34,background:'#ff7a59',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span style={{color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:14}}>H</span>
          </div>
          {sidebar && <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:16,color:'#1a1a1a',whiteSpace:'nowrap'}}>HelixCRM</span>}
        </div>
        <div style={{flex:1,padding:'12px 8px',display:'flex',flexDirection:'column',gap:2}}>
          {navItems.map(item=>(
            <button key={item.id} className={`nav-item${nav===item.id?' active':''}`} onClick={()=>setNav(item.id)}>
              <span style={{fontSize:16,flexShrink:0}}>{item.icon}</span>
              {sidebar && <span style={{whiteSpace:'nowrap'}}>{item.label}</span>}
            </button>
          ))}
        </div>
        <div style={{padding:'12px 8px',borderTop:'1px solid #f0ede8'}}>
          {sidebar && workspace && (
            <div style={{padding:'8px 10px',marginBottom:4,background:'#f5f5f0',borderRadius:8}}>
              <div style={{fontSize:11,fontWeight:700,color:'#ff7a59',marginBottom:2}}>🏢 {workspace.name}</div>
              <div style={{fontSize:10,color:'#aaa'}}>{userRoleName && `${userRoleName} · `}{user?.email}</div>
            </div>
          )}
          {canAccessTeamSettings(userRoleName) && (
            <button className="nav-item" onClick={()=>setTeamOpen(true)}>
              <span style={{fontSize:14}}>👥</span>
              {sidebar && <span>{t('nav.team')}</span>}
            </button>
          )}

          {/* Language picker */}
          <div style={{position:'relative'}}>
            <button className="nav-item" onClick={()=>setLangOpen(o=>!o)}>
              <span style={{fontSize:14}}>{LANGUAGES.find(l=>l.code===lang)?.flag || '🌐'}</span>
              {sidebar && <span style={{fontSize:12}}>{LANGUAGES.find(l=>l.code===lang)?.label || 'Language'}</span>}
            </button>
            {langOpen && (
              <div style={{position:'absolute',bottom:'100%',left:0,background:'#fff',border:'1px solid #e8e5e0',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:999,minWidth:180,padding:6}}>
                {LANGUAGES.map(lng => (
                  <button key={lng.code} onClick={()=>{ setLang(lng.code); setLangOpen(false) }}
                    style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'7px 12px',border:'none',
                      background: lang===lng.code ? '#fff3f0' : 'transparent',
                      borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:13,
                      color: lang===lng.code ? '#ff7a59' : '#444',
                      fontWeight: lang===lng.code ? 700 : 400}}>
                    <span>{lng.flag}</span>
                    <span>{lng.label}</span>
                    {lang===lng.code && <span style={{marginLeft:'auto',color:'#ff7a59'}}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="nav-item" onClick={()=>supabase.auth.signOut()} style={{color:'#c62828'}}>
            <span style={{fontSize:14}}>↪</span>
            {sidebar && <span>{t('nav.signOut')}</span>}
          </button>
          <button className="nav-item" onClick={()=>setSidebar(o=>!o)}>
            <span style={{fontSize:14}}>{sidebar?'◂':'▸'}</span>
            {sidebar && <span>{t('common.close')}</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Topbar */}
        <div style={{background:'#fff',borderBottom:'1px solid #e8e5e0',padding:'0 24px',height:56,display:'flex',alignItems:'center',gap:14,flexShrink:0}}>
          <input className="inp" placeholder="🔍  Search…" style={{maxWidth:360}} value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={{flex:1}}/>
          {userCan('activities','create') && <button className="btn-ghost" style={{fontSize:12}} onClick={()=>setModal('activity')}>⚡ Log</button>}
          {userCan('deals','create') && <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{setEditTarget(null);setModal('deal')}}>{t('deals.new')}</button>}
          {userCan('contacts','create') && <button className="btn-primary" onClick={()=>{setEditTarget(null);setModal('contact')}}>+ Contact</button>}
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:'auto',padding:24}}>

          {/* ── DASHBOARD ── */}
          {nav==='dashboard' && (
            <div style={{animation:'fadeUp 0.3s ease'}}>
              <div style={{marginBottom:24}}>
                <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:26,color:'#1a1a1a'}}>{t('nav.dashboard')}</h1>
                <p style={{color:'#888',fontSize:14,marginTop:4}}>Live data from your Supabase database.</p>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
                {[
                  {label:t('dash.pipeline'), value:fmt$(pipeline), sub:t('dash.deals',{count:deals.length})},
                  {label:t('dash.won'),      value:fmt$(won),      sub:t('dash.closedDeals')},
                  {label:t('dash.openDeals'),value:openDeals,      sub:t('dash.active')},
                  {label:t('dash.winRate'),  value:winRate+'%',    sub:'All time'},
                ].map(m=>(
                  <div key={m.label} className="card" style={{padding:20}}>
                    <div style={{fontSize:12,color:'#888',fontWeight:500,marginBottom:6}}>{m.label}</div>
                    <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:28,color:'#1a1a1a'}}>{m.value}</div>
                    <div style={{fontSize:12,color:'#aaa',marginTop:4}}>{m.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:20}}>
                <div className="card" style={{padding:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <h3 style={{fontWeight:700,fontSize:15}}>{t('dash.recentDeals')}</h3>
                    <button className="btn-ghost" style={{fontSize:12}} onClick={()=>setNav('deals')}>{t('dash.viewAll')}</button>
                  </div>
                  {deals.slice(0,5).map(d=>{
                    const c=contacts.find(x=>x.id===d.contact_id)
                    return (
                      <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #f5f5f0'}}>
                        <div>
                          <div style={{fontWeight:600,fontSize:13}}>{d.name}</div>
                          <div style={{fontSize:12,color:'#888',marginTop:2}}>{c?.name||'—'}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontWeight:700,fontSize:13}}>{fmt$(d.value)}</div>
                          <Pill label={d.stage} map={STAGE_COLORS}/>
                        </div>
                      </div>
                    )
                  })}
                  {deals.length===0 && <div style={{textAlign:'center',color:'#ccc',padding:28,fontSize:13}}>{t('dash.noDeals')}</div>}
                </div>
                <div className="card" style={{padding:20}}>
                  <h3 style={{fontWeight:700,fontSize:15,marginBottom:16}}>{t('dash.recentActivity')}</h3>
                  {activities.slice(0,7).map(a=>(
                    <div key={a.id} style={{display:'flex',gap:12,paddingBottom:12}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:'#ff7a59',flexShrink:0,marginTop:5}}/>
                      <div><div style={{fontSize:13}}>{a.text}</div><div style={{fontSize:11,color:'#aaa',marginTop:2}}>{timeAgo(a.created_at)}</div></div>
                    </div>
                  ))}
                  {activities.length===0 && <div style={{textAlign:'center',color:'#ccc',padding:28,fontSize:13}}>{t('dash.noActivity')}</div>}
                </div>
              </div>
            </div>
          )}

          {/* ── CONTACTS ── */}
          {nav==='contacts' && (
            <div style={{animation:'fadeUp 0.3s ease'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div>
                  <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:24}}>{t('contacts.title')}</h1>
                  <p style={{color:'#888',fontSize:13,marginTop:2}}>{filtContacts.length} records</p>
                </div>
                <button className="btn-primary" onClick={()=>{setEditTarget(null);setModal('contact')}}>+ Add Contact</button>
              </div>
              <div className="card" style={{overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'2.5fr 1.5fr 2fr 1fr 1fr 1fr',padding:'10px 20px',borderBottom:'1px solid #f0ede8',background:'#fafaf8'}}>
                  {['Name','Company','Email','Status','Value','Added'].map(h=>(
                    <div key={h} style={{fontSize:11,fontWeight:700,color:'#aaa',letterSpacing:'0.05em',textTransform:'uppercase'}}>{h}</div>
                  ))}
                </div>
                {filtContacts.map(c=>(
                  <div key={c.id} className="row" style={{gridTemplateColumns:'2.5fr 1.5fr 2fr 1fr 1fr 1fr'}} onClick={()=>setSelected(c)}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:'#ff7a59',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0}}>{c.avatar||initials(c.name)}</div>
                      <span style={{fontWeight:600,fontSize:14}}>{c.name}</span>
                    </div>
                    <span style={{fontSize:13,color:'#444'}}>{c.company}</span>
                    <span style={{fontSize:13,color:'#6b6b6b'}}>{c.email}</span>
                    <Pill label={c.status} map={STATUS_COLORS}/>
                    <span style={{fontWeight:600,fontSize:13}}>{fmt$(c.value)}</span>
                    <span style={{fontSize:12,color:'#aaa'}}>{timeAgo(c.created_at)}</span>
                  </div>
                ))}
                {filtContacts.length===0 && <div style={{padding:40,textAlign:'center',color:'#ccc'}}>No contacts found.</div>}
              </div>
            </div>
          )}

          {/* ── DEALS ── */}
          {nav==='deals' && (
            <div style={{animation:'fadeUp 0.3s ease'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div>
                  <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:24}}>Deals</h1>
                  <p style={{color:'#888',fontSize:13,marginTop:2}}>{filtDeals.length} deals · {fmt$(pipeline)} pipeline</p>
                </div>
                <button className="btn-primary" onClick={()=>{setEditTarget(null);setModal('deal')}}>+ New Deal</button>
              </div>
              <div className="card" style={{overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1fr 80px',padding:'10px 20px',borderBottom:'1px solid #f0ede8',background:'#fafaf8'}}>
                  {['Deal Name','Contact','Value','Stage','Prob.','Close',''].map(h=>(
                    <div key={h} style={{fontSize:11,fontWeight:700,color:'#aaa',letterSpacing:'0.05em',textTransform:'uppercase'}}>{h}</div>
                  ))}
                </div>
                {filtDeals.map(d=>{
                  const c=contacts.find(x=>x.id===d.contact_id)
                  return (
                    <div key={d.id} className="row" style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1fr 80px'}}>
                      <span style={{fontWeight:600,fontSize:13}}>{d.name}</span>
                      <span style={{fontSize:13,color:'#555'}}>{c?.name||'—'}</span>
                      <span style={{fontWeight:700,fontSize:13}}>{fmt$(d.value)}</span>
                      <Pill label={d.stage} map={STAGE_COLORS}/>
                      <div>
                        <span style={{fontSize:12,fontWeight:600}}>{d.probability}%</span>
                        <div className="progress-bar"><div className="progress-fill" style={{width:`${d.probability}%`}}/></div>
                      </div>
                      <span style={{fontSize:12,color:'#888'}}>{d.close_date||'—'}</span>
                      <div style={{display:'flex',gap:6}}>
                        {(userCan('deals','edit_any') || userCan('deals','edit_own')) && <button onClick={()=>{setEditTarget(d);setModal('deal')}} style={{background:'none',border:'none',cursor:'pointer',fontSize:15}}>✏</button>}
                        {userCan('deals','delete_any') && <button onClick={()=>deleteDeal(d.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#e53'}}>🗑</button>}
                      </div>
                    </div>
                  )
                })}
                {filtDeals.length===0 && <div style={{padding:40,textAlign:'center',color:'#ccc'}}>No deals yet.</div>}
              </div>
            </div>
          )}

          {/* ── PIPELINE ── */}
          {nav==='pipeline' && (
            <Pipeline
              deals={deals}
              stages={stages}
              contacts={contacts}
              activities={activities}
              userCan={userCan}
              user={user}
              onNewDeal={() => { setEditTarget(null); setModal('deal') }}
              onEditDeal={d => { setEditTarget(d); setModal('deal') }}
              onRefresh={() => fetchAll(workspace.id)}
            />
          )}

          {/* ── ACTIVITY ── */}
          {nav==='activity' && (
            <ActivityLog
              activities={activities}
              contacts={contacts}
              deals={deals}
              userCan={userCan}
              onLogActivity={(parentAct) => { setFollowUpParent(parentAct || null); setModal('activity') }}
              onLogFollowUp={(parentAct) => { setFollowUpParent(parentAct); setModal('activity') }}
              onRefresh={() => fetchAll(workspace.id)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {modal==='contact' && <ContactForm onSave={saveContact} onClose={()=>setModal(null)} saving={saving}/>}
      {modal==='deal'    && <DealForm initial={editTarget} contacts={contacts} stages={stages} onSave={saveDeal} onClose={()=>{setModal(null);setEditTarget(null)}} saving={saving}/>}
      {modal==='activity' && <ActivityForm contacts={contacts} deals={deals} onSave={saveActivity} onClose={()=>{setModal(null);setFollowUpParent(null)}} saving={saving} parentActivity={followUpParent} />}
      {modal==='contact' && editTarget && <ContactForm initial={editTarget} onSave={saveContact} onClose={()=>{setModal(null);setEditTarget(null)}} saving={saving}/>}

      {selected && (
        <ContactPanel
          contact={selected} deals={deals} activities={activities}
          onEdit={()=>{setEditTarget(selected);setModal('contact')}}
          onDelete={()=>deleteContact(selected.id)}
          onClose={()=>setSelected(null)}
        />
      )}

      {teamOpen && <TeamSettings workspace={workspace} currentUser={user} stages={stages} onRefresh={()=>fetchAll(workspace.id)} onClose={()=>setTeamOpen(false)} />}
      <Toast msg={toast}/>
    </div>
  )
}
