// src/ActivityLog.jsx
import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabaseClient'

const ACT_ICONS = { call:'📞', email:'✉️', meeting:'🗓', note:'📝', stage_change:'🔄', task:'✅' }
const ACT_TYPES = ['call','email','meeting','note','task']
// A follow-up is overdue when its due date has passed and it's not marked done
const isOverdue = (date, done) => !done && date && new Date(date) < new Date()

// A task is overdue when its activity_at (the due date) has passed and not done
const isTaskOverdue = (activity) =>
  activity.type === 'task' &&
  !activity.follow_up_done &&
  activity.activity_at &&
  new Date(activity.activity_at) < new Date()

const fmt = d => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s/60) + 'm ago'
  if (s < 86400) return Math.floor(s/3600) + 'h ago'
  if (s < 604800) return Math.floor(s/86400) + 'd ago'
  return new Date(d).toLocaleDateString()
}

// ─── Activity Form ─────────────────────────────────────────────
// NOTE: form state lives here permanently — never unmounts while open
// so tab switching cannot clear it.
export function ActivityForm({ contacts, deals, onSave, onClose, saving, initialDealId, initialContactId, parentActivity }) {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const [f, setF] = useState({
    type:             'call',
    contact_id:       initialContactId || contacts[0]?.id || '',
    deal_id:          initialDealId || '',
    text:             parentActivity ? `Follow-up: ${parentActivity.follow_up_action}` : '',
    activity_at:      parentActivity?.follow_up_date?.slice(0,16) || localNow,
    duration_mins:    '',
    notes:            '',
    follow_up_action: '',
    follow_up_date:   '',
  })
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const isTask = f.type === 'task'

  const inp = { border:'1px solid #e0ddd8', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box', background:'#fff' }
  const lbl = { display:'block', fontSize:11, fontWeight:700, color:'#888', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }

  const canSave = f.text && (isTask || f.contact_id)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
      <div style={{ background:'#fff', borderRadius:16, width:580, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.18)', animation:'popIn 0.18s ease' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:'1px solid #f0ede8' }}>
          <div>
            <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18 }}>
              {parentActivity ? '📌 Log Follow-up Activity' : isTask ? '✅ New Task' : 'Log Activity'}
            </span>
            {parentActivity && (
              <div style={{ fontSize:12, color:'#888', marginTop:3 }}>
                Linked to: <span style={{ color:'#ff7a59', fontWeight:600 }}>{parentActivity.text}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#aaa' }}>✕</button>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Type selector */}
          <div>
            <div style={lbl}>Type</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {ACT_TYPES.map(t => (
                <button key={t} onClick={() => setF(p => ({ ...p, type: t }))}
                  style={{ padding:'8px 14px', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700,
                    background: f.type === t ? (t==='task'?'#2e7d32':'#ff7a59') : '#f5f5f0',
                    color: f.type === t ? '#fff' : '#666', transition:'all 0.15s' }}>
                  {ACT_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {isTask && (
              <div style={{ marginTop:8, background:'#e8f5e9', border:'1px solid #c8e6c9', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#2e7d32' }}>
                ✅ <strong>Task</strong> — independent to-do item. No contact required. Set a due date and mark done when complete.
              </div>
            )}
          </div>

          {/* Contact + Deal — hidden for tasks (both optional) */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={lbl}>Contact {isTask ? '(optional)' : ''}</div>
              <select value={f.contact_id} onChange={set('contact_id')} style={inp}>
                <option value="">— No contact —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Deal (optional)</div>
              <select value={f.deal_id} onChange={set('deal_id')} style={inp}>
                <option value="">— No deal —</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <div style={lbl}>{isTask ? 'Task Title' : 'Summary'}</div>
            <input value={f.text} onChange={set('text')}
              placeholder={isTask ? 'e.g. Prepare Q2 pitch deck, Review contract, Update CRM' :
                f.type === 'call' ? 'Discovery call with CEO' :
                f.type === 'email' ? 'Sent pricing proposal' :
                f.type === 'meeting' ? 'Product demo' : 'Internal note'}
              style={inp} />
          </div>

          {/* Date — "Due Date" for tasks, "Date & Time" for others */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={lbl}>{isTask ? 'Due Date & Time' : 'Date & Time'}</div>
              <input type="datetime-local" value={f.activity_at} onChange={set('activity_at')} style={inp} />
            </div>
            {(f.type === 'call' || f.type === 'meeting') && (
              <div>
                <div style={lbl}>Duration (minutes)</div>
                <input type="number" value={f.duration_mins} onChange={set('duration_mins')} placeholder="e.g. 30" min="1" max="480" style={inp} />
              </div>
            )}
          </div>

          {/* Notes — hidden for tasks (keep it simple) */}
          {!isTask && (
            <div>
              <div style={lbl}>{f.type === 'meeting' ? 'Meeting Minutes' : 'Notes'}</div>
              <textarea value={f.notes} onChange={set('notes')}
                placeholder={f.type === 'meeting' ? 'Key discussion points, decisions made, action items…' : 'Additional notes or context…'}
                rows={4} style={{ ...inp, resize:'vertical', lineHeight:1.5 }} />
            </div>
          )}

          {/* Follow-up — hidden for tasks (tasks ARE the follow-up) */}
          {!isTask && (
            <div style={{ background:'#fff8f0', border:'1px solid #ffe0b2', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#e65100', marginBottom:12 }}>
                📌 Follow-up Action
                <span style={{ fontWeight:400, color:'#aaa', marginLeft:8 }}>— creates a linked child activity</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div>
                  <div style={lbl}>Action Required</div>
                  <input value={f.follow_up_action} onChange={set('follow_up_action')}
                    placeholder="e.g. Send contract, Schedule demo, Follow up on pricing" style={inp} />
                </div>
                <div>
                  <div style={lbl}>Due Date & Time</div>
                  <input type="datetime-local" value={f.follow_up_date} onChange={set('follow_up_date')} style={inp} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={{ background:'transparent', border:'1px solid #e0ddd8', color:'#444', padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button disabled={saving || !canSave} onClick={() => onSave(f)}
              style={{ background: isTask ? '#2e7d32' : '#ff7a59', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:600,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: (saving || !canSave) ? 0.6 : 1, fontFamily:'inherit' }}>
              {saving ? 'Saving…' : isTask ? '✅ Add Task' : '⚡ Log Activity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Stage Change Note Modal ───────────────────────────────────
export function StageChangeModal({ deal, fromStage, toStage, onConfirm, onCancel, saving }) {
  const [notes, setNotes] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}>
      <div style={{ background:'#fff', borderRadius:16, width:480, boxShadow:'0 24px 64px rgba(0,0,0,0.18)', animation:'popIn 0.18s ease' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #f0ede8' }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18, marginBottom:4 }}>🔄 Stage Change</div>
          <div style={{ fontSize:13, color:'#888' }}>
            Moving <strong>{deal.name}</strong>
          </div>
        </div>
        <div style={{ padding:'20px 24px' }}>
          {/* Stage transition visual */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <div style={{ padding:'6px 14px', borderRadius:20, background:fromStage?.color+'22', color:fromStage?.color, fontWeight:700, fontSize:13, border:`1px solid ${fromStage?.color}44` }}>
              {fromStage?.name}
            </div>
            <span style={{ color:'#aaa', fontSize:18 }}>→</span>
            <div style={{ padding:'6px 14px', borderRadius:20, background:toStage?.color+'22', color:toStage?.color, fontWeight:700, fontSize:13, border:`1px solid ${toStage?.color}44` }}>
              {toStage?.name}
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>
              Notes / Reason for stage change
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={`Why is this deal moving to ${toStage?.name}? What happened?`}
              autoFocus
              rows={4}
              style={{ border:'1px solid #e0ddd8', borderRadius:8, padding:'10px 12px', fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box', resize:'vertical', lineHeight:1.5 }}
            />
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onCancel} style={{ background:'transparent', border:'1px solid #e0ddd8', color:'#444', padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button onClick={() => onConfirm(notes)} disabled={saving}
              style={{ background:'#ff7a59', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Moving…' : 'Confirm Move'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Chain ────────────────────────────────────────────
// Renders a single activity and recursively its follow-up children
const ActivityChain = ({ activity, contacts, deals, depth, onMarkFollowUpDone, onLogFollowUp }) => {
  const contact = contacts.find(c => c.id === activity.contact_id)
  const deal    = deals.find(d => d.id === activity.deal_id)
  const overdue = isOverdue(activity.follow_up_date, activity.follow_up_done) || isTaskOverdue(activity)

  return (
    <div style={{ marginLeft: depth * 24, borderLeft: depth > 0 ? '2px solid #f0ede8' : 'none', paddingLeft: depth > 0 ? 16 : 0, marginTop: depth > 0 ? 12 : 0 }}>
      <div style={{ display:'flex', gap:12 }}>
        {/* Icon */}
        <div style={{ width:36, height:36, borderRadius:9, background: depth > 0 ? '#f0ede8' : '#fff8f6',
          border:`1px solid ${depth > 0 ? '#e0ddd8' : '#fce0d8'}`, display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:16, flexShrink:0 }}>
          {ACT_ICONS[activity.type] || '⚡'}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{activity.text}</div>
            {overdue && <span style={{ background:'#fce4ec', color:'#c62828', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, flexShrink:0, marginLeft:8 }}>🔴 OVERDUE</span>}
          </div>

          {/* Meta row */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:4 }}>
            {contact && <span style={{ fontSize:11, color:'#aaa' }}>👤 {contact.name}{contact.company ? ` · ${contact.company}` : ''}</span>}
            {deal    && <span style={{ fontSize:11, color:'#ff7a59', fontWeight:600 }}>💼 {deal.name}</span>}
            <span style={{ fontSize:11, color:'#aaa' }}>🕐 {activity.activity_at ? new Date(activity.activity_at).toLocaleString() : fmt(activity.created_at)}</span>
            {activity.duration_mins && <span style={{ fontSize:11, color:'#aaa' }}>⏱ {activity.duration_mins}min</span>}
          </div>

          {/* Notes */}
          {activity.notes && (
            <div style={{ background:'#f9f8f6', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#555', lineHeight:1.6, marginBottom:8 }}>
              {activity.notes}
            </div>
          )}

          {/* Stage change badge */}
          {activity.type === 'stage_change' && (() => {
            try { const d = JSON.parse(activity.notes || '{}'); return d.from && d.to ? (
              <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>
                <span style={{ background:'#f5f5f0', padding:'2px 8px', borderRadius:10 }}>{d.from}</span>
                <span style={{ margin:'0 6px', color:'#ccc' }}>→</span>
                <span style={{ background:'#f5f5f0', padding:'2px 8px', borderRadius:10, fontWeight:700, color:'#ff7a59' }}>{d.to}</span>
              </div>
            ) : null } catch(e) { return null }
          })()}

          {/* Task completion status */}
          {activity.type === 'task' && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, marginTop:4,
              background: activity.follow_up_done ? '#e8f5e9' : (isTaskOverdue(activity) ? '#fce4ec' : '#fff8f0'),
              border:`1px solid ${activity.follow_up_done ? '#c8e6c9' : (isTaskOverdue(activity) ? '#f8bbd0' : '#ffe0b2')}` }}>
              <div style={{ flex:1, fontSize:12 }}>
                <span style={{ fontWeight:700, color: activity.follow_up_done ? '#2e7d32' : (isTaskOverdue(activity) ? '#c62828' : '#e65100') }}>
                  {activity.follow_up_done ? '✅ Done' : (isTaskOverdue(activity) ? '🔴 Overdue' : '⏳ Pending')}
                </span>
                {activity.activity_at && <span style={{ color:'#aaa', marginLeft:8 }}>Due: {new Date(activity.activity_at).toLocaleString()}</span>}
              </div>
              {!activity.follow_up_done && (
                <button onClick={() => onMarkFollowUpDone(activity.id)}
                  style={{ background:'#fff', border:'1px solid #e0ddd8', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Mark done
                </button>
              )}
            </div>
          )}

          {/* Follow-up block */}
          {activity.type !== 'task' && activity.follow_up_action && (
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 10px', borderRadius:8, marginTop:4,
              background: activity.follow_up_done ? '#e8f5e9' : (overdue ? '#fce4ec' : '#fff8f0'),
              border:`1px solid ${activity.follow_up_done ? '#c8e6c9' : (overdue ? '#f8bbd0' : '#ffe0b2')}` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color: activity.follow_up_done ? '#2e7d32' : (overdue ? '#c62828' : '#e65100'), marginBottom:2 }}>
                  {activity.follow_up_done ? '✅ Completed' : (overdue ? '🔴 Overdue' : '📌 Follow-up required')}
                </div>
                <div style={{ fontSize:12, color:'#555' }}>{activity.follow_up_action}</div>
                {activity.follow_up_date && <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>Due: {new Date(activity.follow_up_date).toLocaleString()}</div>}
              </div>
              {!activity.follow_up_done && (
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => onLogFollowUp(activity)}
                    style={{ background:'#ff7a59', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    Log follow-up
                  </button>
                  <button onClick={() => onMarkFollowUpDone(activity.id)}
                    style={{ background:'#fff', border:'1px solid #e0ddd8', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    Mark done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ActivityLog Component ────────────────────────────────
export default function ActivityLog({ activities, contacts, deals, userCan, onLogActivity, onLogFollowUp, onRefresh }) {
  const [filter, setFilter] = useState('all')
  const overdueCount = activities.filter(a => isOverdue(a.follow_up_date, a.follow_up_done) || isTaskOverdue(a)).length

  // Only show root activities (no parent) in main list — children shown inline
  const rootActivities = activities.filter(a => !a.parent_activity_id)

  const filtered = rootActivities.filter(a => {
    if (filter === 'overdue')    return isOverdue(a.follow_up_date, a.follow_up_done) || isTaskOverdue(a)
    if (filter === 'follow-ups') return a.follow_up_action && !a.follow_up_done
    if (ACT_TYPES.includes(filter)) return a.type === filter
    return true
  })

  const markFollowUpDone = async (id) => {
    await supabase.from('activities').update({ follow_up_done: true }).eq('id', id)
    onRefresh()
  }

  // Get child activities (follow-ups) for a given parent
  const getChildren = (parentId) => activities.filter(a => a.parent_activity_id === parentId)

  // Recursively render an activity and all its follow-up children
  const renderChain = (activity, depth = 0) => {
    const children = getChildren(activity.id)
    return (
      <div key={activity.id}>
        <ActivityChain
          activity={activity}
          contacts={contacts}
          deals={deals}
          depth={depth}
          onMarkFollowUpDone={markFollowUpDone}
          onLogFollowUp={onLogFollowUp}
        />
        {children.map(child => renderChain(child, depth + 1))}
      </div>
    )
  }

  return (
    <div style={{ animation:'fadeUp 0.3s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:24, margin:0 }}>Activity</h1>
          <p style={{ color:'#888', fontSize:13, margin:'4px 0 0' }}>
            {activities.length} logged ·{' '}
            {overdueCount > 0
              ? <span style={{ color:'#c62828', fontWeight:700 }}>{overdueCount} overdue follow-up{overdueCount!==1?'s':''}</span>
              : 'no overdue follow-ups'}
          </p>
        </div>
        {userCan('activities','create') && (
          <button className="btn-primary" onClick={() => onLogActivity()}>⚡ Log Activity</button>
        )}
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div style={{ background:'#fce4ec', border:'1px solid #f8bbd0', borderRadius:10, padding:'10px 16px', marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>🔴</span>
          <div>
            <span style={{ fontWeight:700, fontSize:13, color:'#c62828' }}>{overdueCount} overdue follow-up{overdueCount!==1?'s':''}</span>
            <span style={{ fontSize:12, color:'#888', marginLeft:8 }}>overdue follow-ups & tasks — click to review</span>
          </div>
          <button onClick={() => setFilter('overdue')} style={{ marginLeft:'auto', background:'#c62828', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Review</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:20 }}>
        <div className="card" style={{ padding:24 }}>
          {/* Filter tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            {[['all','All'],['overdue','🔴 Overdue'],['follow-ups','📌 Follow-ups'],['task','✅ Tasks'],['call','📞 Calls'],['email','✉️ Emails'],['meeting','🗓 Meetings'],['note','📝 Notes']].map(([id, label]) => (
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

          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {filtered.map(a => renderChain(a))}
          </div>
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
              ['Overdue (tasks+follow-ups)', overdueCount, '#c62828'],
              ['Completed', activities.filter(a => a.follow_up_done).length, '#2e7d32'],
            ].map(([label, count, color]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f5f5f0' }}>
                <span style={{ fontSize:13, color:'#666' }}>{label}</span>
                <span style={{ fontWeight:800, fontSize:14, color }}>{count}</span>
              </div>
            ))}
            {userCan('activities','create') && (
              <button className="btn-primary" style={{ width:'100%', marginTop:16, padding:'10px 18px' }} onClick={() => onLogActivity()}>⚡ Log Activity</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
