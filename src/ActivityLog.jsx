// src/ActivityLog.jsx
// Full activity log with datetime, notes, minutes, follow-up actions + overdue badges
import { useState } from 'react'
import { supabase } from './supabaseClient'

const ACT_ICONS = { call:'📞', email:'✉️', meeting:'🗓', note:'📝' }
const ACT_TYPES = ['call','email','meeting','note']

const timeAgo = d => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s/60) + 'm ago'
  if (s < 86400) return Math.floor(s/3600) + 'h ago'
  if (s < 604800) return Math.floor(s/86400) + 'd ago'
  return new Date(d).toLocaleDateString()
}

const isOverdue = (date, done) => !done && date && new Date(date) < new Date()

// ─── Activity Form ────────────────────────────────────────────
export function ActivityForm({ contacts, onSave, onClose, saving }) {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const [f, setF] = useState({
    type:            'call',
    contact_id:      contacts[0]?.id || '',
    text:            '',
    activity_at:     localNow,
    duration_mins:   '',
    notes:           '',
    follow_up_action:'',
    follow_up_date:  '',
  })
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))

  const inp = { border:'1px solid #e0ddd8', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box', background:'#fff' }
  const label = { display:'block', fontSize:11, fontWeight:700, color:'#888', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
      <div style={{ background:'#fff', borderRadius:16, width:560, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.18)', animation:'popIn 0.18s ease' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:'1px solid #f0ede8' }}>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18 }}>Log Activity</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#aaa' }}>✕</button>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Type selector */}
          <div>
            <div style={label}>Type</div>
            <div style={{ display:'flex', gap:8 }}>
              {ACT_TYPES.map(t => (
                <button key={t} onClick={() => setF(p => ({ ...p, type: t }))}
                  style={{ flex:1, padding:'9px 0', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700,
                    background: f.type === t ? '#ff7a59' : '#f5f5f0',
                    color: f.type === t ? '#fff' : '#666', transition:'all 0.15s' }}>
                  {ACT_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <div style={label}>Contact</div>
            <select value={f.contact_id} onChange={set('contact_id')} style={inp}>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
            </select>
          </div>

          {/* Title / summary */}
          <div>
            <div style={label}>Summary</div>
            <input value={f.text} onChange={set('text')} placeholder={`e.g. ${f.type === 'call' ? 'Discovery call with CEO' : f.type === 'email' ? 'Sent pricing proposal' : f.type === 'meeting' ? 'Product demo' : 'Internal note'}`} style={inp} />
          </div>

          {/* Date/time + duration (side by side) */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={label}>Date & Time</div>
              <input type="datetime-local" value={f.activity_at} onChange={set('activity_at')} style={inp} />
            </div>
            {(f.type === 'call' || f.type === 'meeting') && (
              <div>
                <div style={label}>Duration (minutes)</div>
                <input type="number" value={f.duration_mins} onChange={set('duration_mins')} placeholder="e.g. 30" min="1" max="480" style={inp} />
              </div>
            )}
          </div>

          {/* Notes / minutes */}
          <div>
            <div style={label}>{f.type === 'meeting' ? 'Meeting Minutes' : 'Notes'}</div>
            <textarea value={f.notes} onChange={set('notes')}
              placeholder={f.type === 'meeting' ? 'Key discussion points, decisions made, action items…' : 'Additional notes or context…'}
              rows={4} style={{ ...inp, resize:'vertical', lineHeight:1.5 }} />
          </div>

          {/* Follow-up */}
          <div style={{ background:'#fff8f0', border:'1px solid #ffe0b2', borderRadius:10, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#e65100', marginBottom:12 }}>📌 Follow-up Action</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <div style={label}>Action Required</div>
                <input value={f.follow_up_action} onChange={set('follow_up_action')} placeholder="e.g. Send contract, Schedule demo, Follow up on pricing" style={inp} />
              </div>
              <div>
                <div style={label}>Due Date</div>
                <input type="datetime-local" value={f.follow_up_date} onChange={set('follow_up_date')} style={inp} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:4 }}>
            <button onClick={onClose} style={{ background:'transparent', border:'1px solid #e0ddd8', color:'#444', padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button disabled={saving || !f.text || !f.contact_id} onClick={() => onSave(f)}
              style={{ background:'#ff7a59', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:(saving||!f.text)?0.6:1, fontFamily:'inherit' }}>
              {saving ? 'Saving…' : '⚡ Log Activity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Card ────────────────────────────────────────────
const ActivityCard = ({ activity, contact, onMarkFollowUpDone, isLast }) => {
  const overdue = isOverdue(activity.follow_up_date, activity.follow_up_done)

  return (
    <div style={{ display:'flex', gap:16, paddingBottom:20 }}>
      {/* Icon + connector */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:'#fff8f6', border:'1px solid #fce0d8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
          {ACT_ICONS[activity.type] || '⚡'}
        </div>
        {!isLast && <div style={{ width:2, flex:1, background:'#f0ede8', marginTop:8 }} />}
      </div>

      {/* Content */}
      <div style={{ flex:1, paddingTop:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>{activity.text}</div>
          {overdue && (
            <span style={{ background:'#fce4ec', color:'#c62828', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, flexShrink:0, marginLeft:8 }}>
              🔴 OVERDUE
            </span>
          )}
        </div>

        {contact && <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>{contact.name}{contact.company ? ` · ${contact.company}` : ''}</div>}

        {/* Date + duration */}
        <div style={{ display:'flex', gap:10, marginBottom:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#aaa' }}>🕐 {activity.activity_at ? new Date(activity.activity_at).toLocaleString() : timeAgo(activity.created_at)}</span>
          {activity.duration_mins && <span style={{ fontSize:11, color:'#aaa' }}>⏱ {activity.duration_mins} min</span>}
        </div>

        {/* Notes */}
        {activity.notes && (
          <div style={{ background:'#f9f8f6', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#555', lineHeight:1.6, marginBottom:8 }}>
            {activity.notes}
          </div>
        )}

        {/* Follow-up */}
        {activity.follow_up_action && (
          <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 10px', borderRadius:8, marginTop:4,
            background: activity.follow_up_done ? '#e8f5e9' : (overdue ? '#fce4ec' : '#fff8f0'),
            border: `1px solid ${activity.follow_up_done ? '#c8e6c9' : (overdue ? '#f8bbd0' : '#ffe0b2')}` }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color: activity.follow_up_done ? '#2e7d32' : (overdue ? '#c62828' : '#e65100'), marginBottom:2 }}>
                {activity.follow_up_done ? '✅ Completed' : (overdue ? '🔴 Overdue' : '📌 Follow-up')}
              </div>
              <div style={{ fontSize:12, color:'#555' }}>{activity.follow_up_action}</div>
              {activity.follow_up_date && (
                <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>
                  Due: {new Date(activity.follow_up_date).toLocaleString()}
                </div>
              )}
            </div>
            {!activity.follow_up_done && (
              <button onClick={() => onMarkFollowUpDone(activity.id)}
                style={{ background:'#fff', border:'1px solid #e0ddd8', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                Mark done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Activity Log Component ──────────────────────────────
export default function ActivityLog({ activities, contacts, userCan, onLogActivity, onRefresh }) {
  const [filter, setFilter] = useState('all')

  const overdueCount = activities.filter(a => isOverdue(a.follow_up_date, a.follow_up_done)).length

  const filtered = activities.filter(a => {
    if (filter === 'overdue') return isOverdue(a.follow_up_date, a.follow_up_done)
    if (filter === 'follow-ups') return a.follow_up_action && !a.follow_up_done
    if (ACT_TYPES.includes(filter)) return a.type === filter
    return true
  })

  const markFollowUpDone = async (id) => {
    await supabase.from('activities').update({ follow_up_done: true }).eq('id', id)
    onRefresh()
  }

  return (
    <div style={{ animation:'fadeUp 0.3s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:24, margin:0 }}>Activity</h1>
          <p style={{ color:'#888', fontSize:13, margin:'4px 0 0' }}>{activities.length} logged · {overdueCount > 0 ? <span style={{ color:'#c62828', fontWeight:700 }}>{overdueCount} overdue follow-up{overdueCount!==1?'s':''}</span> : 'no overdue follow-ups'}</p>
        </div>
        {userCan('activities','create') && <button className="btn-primary" onClick={onLogActivity}>⚡ Log Activity</button>}
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div style={{ background:'#fce4ec', border:'1px solid #f8bbd0', borderRadius:10, padding:'10px 16px', marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>🔴</span>
          <div>
            <span style={{ fontWeight:700, fontSize:13, color:'#c62828' }}>{overdueCount} overdue follow-up{overdueCount!==1?'s':''}</span>
            <span style={{ fontSize:12, color:'#888', marginLeft:8 }}>— click "Overdue" filter to review</span>
          </div>
          <button onClick={() => setFilter('overdue')} style={{ marginLeft:'auto', background:'#c62828', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Review
          </button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:20 }}>
        {/* Timeline */}
        <div className="card" style={{ padding:24 }}>
          {/* Filter tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            {[['all','All'], ['overdue','🔴 Overdue'], ['follow-ups','📌 Follow-ups'], ['call','📞 Calls'], ['email','✉️ Emails'], ['meeting','🗓 Meetings'], ['note','📝 Notes']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)}
                style={{ padding:'5px 11px', border:'none', borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'inherit',
                  background: filter===id ? (id==='overdue'?'#c62828':'#ff7a59') : '#f5f5f0',
                  color: filter===id ? '#fff' : '#666', transition:'all 0.15s' }}>
                {label}{id==='overdue' && overdueCount>0 ? ` (${overdueCount})` : ''}
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign:'center', color:'#ccc', padding:'40px 0', fontSize:13 }}>
              {filter === 'overdue' ? '✅ No overdue follow-ups!' : 'No activities match this filter.'}
            </div>
          )}

          {filtered.map((a, i) => (
            <ActivityCard
              key={a.id}
              activity={a}
              contact={contacts.find(c => c.id === a.contact_id)}
              onMarkFollowUpDone={markFollowUpDone}
              isLast={i === filtered.length - 1}
            />
          ))}
        </div>

        {/* Stats sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card" style={{ padding:20 }}>
            <h3 style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Activity Stats</h3>
            {ACT_TYPES.map(t => (
              <div key={t} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f5f5f0' }}>
                <span style={{ fontSize:13, color:'#666' }}>{ACT_ICONS[t]} {t.charAt(0).toUpperCase()+t.slice(1)}s</span>
                <span style={{ fontWeight:700, fontSize:13 }}>{activities.filter(a => a.type===t).length}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding:20 }}>
            <h3 style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Follow-ups</h3>
            {[
              ['Pending', activities.filter(a => a.follow_up_action && !a.follow_up_done && !isOverdue(a.follow_up_date, a.follow_up_done)).length, '#e65100'],
              ['Overdue', overdueCount, '#c62828'],
              ['Completed', activities.filter(a => a.follow_up_done).length, '#2e7d32'],
            ].map(([label, count, color]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f5f5f0' }}>
                <span style={{ fontSize:13, color:'#666' }}>{label}</span>
                <span style={{ fontWeight:800, fontSize:14, color }}>{count}</span>
              </div>
            ))}
            {userCan('activities','create') && (
              <button className="btn-primary" style={{ width:'100%', marginTop:16, padding:'10px 18px' }} onClick={onLogActivity}>⚡ Log Activity</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
