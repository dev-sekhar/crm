// src/Auth.jsx
import { useState } from 'react'
import { supabase } from './supabaseClient'
import { DEFAULT_JOIN_ROLE } from './permissions'
import { useTranslation } from './i18n'

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
    {children}
  </div>
)

const Inp = (props) => (
  <input style={{ width: '100%', border: '1px solid #e0ddd8', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
    onFocus={e => e.target.style.borderColor = '#ff7a59'}
    onBlur={e => e.target.style.borderColor = '#e0ddd8'}
    {...props} />
)

const Btn = ({ loading, children, ...props }) => (
  <button style={{ width: '100%', background: '#ff7a59', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit', transition: 'background 0.15s' }}
    onMouseEnter={e => { if (!loading) e.target.style.background = '#e8633d' }}
    onMouseLeave={e => e.target.style.background = '#ff7a59'}
    disabled={loading} {...props}>
    {loading ? 'Please wait…' : children}
  </button>
)

const Card = ({ children, title, subtitle }) => (
  <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff8f6 0%, #f5f5f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 48, height: 48, background: '#ff7a59', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <span style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22 }}>H</span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: '#1a1a1a', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: '#888', fontSize: 14, marginTop: 8 }}>{subtitle}</p>}
      </div>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #f0ede8' }}>
        {children}
      </div>
    </div>
  </div>
)

const Error = ({ msg }) => msg ? (
  <div style={{ background: '#fce4ec', border: '1px solid #f8bbd0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c62828', marginBottom: 16 }}>{msg}</div>
) : null

const Success = ({ msg }) => msg ? (
  <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#2e7d32', marginBottom: 16 }}>{msg}</div>
) : null

// ─── LOGIN ────────────────────────────────────────────────────
export function Login({ onSwitch }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    if (!email || !password) return setError('Please fill in all fields.')
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError(err.message)
  }

  return (
    <Card title="Welcome back" subtitle="Sign in to your HelixCRM workspace">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;700&display=swap')`}</style>
      <Error msg={error} />
      <Field label={t('auth.email')}><Inp type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" onKeyDown={e => e.key === 'Enter' && handle()} /></Field>
      <Field label={t('auth.password')}><Inp type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handle()} /></Field>
      <Btn loading={loading} onClick={handle}>{t('auth.signIn')}</Btn>
      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
        {t('auth.noAccount')}{' '}
        <button onClick={() => onSwitch('register')} style={{ background: 'none', border: 'none', color: '#ff7a59', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>{t('auth.signUp')}</button>
      </p>
    </Card>
  )
}

// ─── REGISTER ─────────────────────────────────────────────────
export function Register({ onSwitch }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handle = async () => {
    if (!form.fullName || !form.email || !form.password) return setError('Please fill in all fields.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } }
    })
    setLoading(false)
    if (err) return setError(err.message)
    setSuccess('Account created! Check your email to confirm, then sign in.')
  }

  return (
    <Card title="Create account" subtitle="Start managing your CRM in minutes">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;700&display=swap')`}</style>
      <Error msg={error} />
      <Success msg={success} />
      {!success && <>
        <Field label={t('auth.fullName')}><Inp value={form.fullName} onChange={set('fullName')} placeholder="Jane Smith" /></Field>
        <Field label={t('auth.email')}><Inp type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" /></Field>
        <Field label={t('auth.password')}><Inp type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" /></Field>
        <Field label="Confirm Password"><Inp type="password" value={form.confirm} onChange={set('confirm')} placeholder="Repeat password" onKeyDown={e => e.key === 'Enter' && handle()} /></Field>
        <Btn loading={loading} onClick={handle}>{t('auth.register')}</Btn>
      </>}
      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
        {t('auth.hasAccount')}{' '}
        <button onClick={() => onSwitch('login')} style={{ background: 'none', border: 'none', color: '#ff7a59', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>{t('auth.signIn')}</button>
      </p>
    </Card>
  )
}

// ─── CREATE OR JOIN WORKSPACE ──────────────────────────────────
export function WorkspaceSetup({ user, onDone }) {
  const [tab, setTab] = useState('create') // 'create' | 'join'
  const [form, setForm] = useState({ name: '', slug: '' })
  const [joinSlug, setJoinSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => {
    const val = e.target.value
    setForm(p => ({
      ...p,
      [k]: val,
      ...(k === 'name' ? { slug: val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30) } : {})
    }))
  }

  const createWorkspace = async () => {
    if (!form.name || !form.slug) return setError('Please fill in all fields.')
    setLoading(true); setError('')
    // Use security definer function to bypass RLS on first insert
    const { data, error: fnErr } = await supabase.rpc('create_workspace_with_owner', {
      ws_name:    form.name,
      ws_slug:    form.slug,
      owner_id:   user.id,
      owner_name: user.user_metadata?.full_name || ''
    })
    setLoading(false)
    if (fnErr) return setError(fnErr.message)
    onDone(typeof data === 'string' ? JSON.parse(data) : data)
  }

  const joinWorkspace = async () => {
    if (!joinSlug) return setError('Enter a workspace slug.')
    setLoading(true); setError('')

    // Fetch workspace by slug via RPC (user not a member yet so RLS would block direct query)
    const { data: ws, error: wsErr } = await supabase
      .rpc('get_workspace_by_slug', { ws_slug: joinSlug.toLowerCase() })
    if (wsErr || !ws) { setLoading(false); return setError('Workspace not found. Check the slug.') }
    const workspace = Array.isArray(ws) ? ws[0] : ws
    if (!workspace) { setLoading(false); return setError('Workspace not found. Check the slug.') }

    // Look up the default join role for this workspace (defined in permissions.js)
    const { data: viewerRole } = await supabase
      .from('roles')
      .select('id, name')
      .eq('workspace_id', workspace.id)
      .eq('name', DEFAULT_JOIN_ROLE)
      .single()

    // Insert membership with Viewer as default role
    const { error: memErr } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id:      user.id,
        role:         'member',
        role_id:      viewerRole?.id || null,
        full_name:    user.user_metadata?.full_name || ''
      })
    setLoading(false)
    if (memErr) return setError(memErr.code === '23505' ? 'You are already a member of this workspace.' : memErr.message)
    onDone(workspace)
  }

  return (
    <Card title="Set up your workspace" subtitle="A workspace holds all your CRM data and team members">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;700&display=swap')`}</style>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, background: '#f5f5f0', borderRadius: 8, padding: 4, marginBottom: 24 }}>
        {[['create', '🏢 Create new'], ['join', '🔗 Join existing']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setError('') }} style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: tab === id ? '#fff' : 'transparent', color: tab === id ? '#1a1a1a' : '#888', boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>{label}</button>
        ))}
      </div>

      <Error msg={error} />

      {tab === 'create' && <>
        <Field label="Company / Team Name">
          <Inp value={form.name} onChange={set('name')} placeholder="Acme Corp" />
        </Field>
        <Field label="Workspace Slug">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#aaa', pointerEvents: 'none' }}>helixcrm.app/</span>
            <Inp value={form.slug} onChange={set('slug')} placeholder="acme-corp" style={{ paddingLeft: 108 }} />
          </div>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Share this slug with teammates so they can join your workspace.</p>
        </Field>
        <Btn loading={loading} onClick={createWorkspace}>Create Workspace →</Btn>
      </>}

      {tab === 'join' && <>
        <Field label="Workspace Slug">
          <Inp value={joinSlug} onChange={e => setJoinSlug(e.target.value)} placeholder="acme-corp" onKeyDown={e => e.key === 'Enter' && joinWorkspace()} />
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Ask your team owner for the workspace slug.</p>
        </Field>
        <Btn loading={loading} onClick={joinWorkspace}>Join Workspace →</Btn>
      </>}

      <div style={{ marginTop: 20, padding: 14, background: '#f5f5f0', borderRadius: 8 }}>
        <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6, margin: 0 }}>
          Signed in as <strong>{user.email}</strong> ·{' '}
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: '#ff7a59', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: 0 }}>Sign out</button>
        </p>
      </div>
    </Card>
  )
}
