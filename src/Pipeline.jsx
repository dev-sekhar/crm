// src/Pipeline.jsx
// Kanban pipeline with drag-and-drop, deal detail modal, stage legend
import { useState } from 'react'
import { supabase } from './supabaseClient'
import { StageChangeModal } from './ActivityLog'

const fmt$ = v => '$' + Number(v||0).toLocaleString()
const timeAgo = d => { if(!d) return ''; const s=Math.floor((Date.now()-new Date(d))/1000); if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago'; if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago' }

// ─── Deal Detail Modal ────────────────────────────────────────
const DealModal = ({ deal, contact, stage, stages, activities, onClose, onEdit, onStageChange }) => {
  const dealActivities = activities
    .filter(a => a.deal_id === deal.id || a.contact_id === deal.contact_id)
    .sort((a,b) => new Date(b.activity_at || b.created_at) - new Date(a.activity_at || a.created_at))
  const ACT_ICONS = { call:'📞', email:'✉️', meeting:'🗓', note:'📝', stage_change:'🔄', task:'✅' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:400 }}>
      <div style={{ background:'#fff', borderRadius:16, width:680, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', animation:'popIn 0.18s ease' }}>

        {/* Header */}
        <div style={{ padding:'22px 28px 18px', borderBottom:'1px solid #f0ede8', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:20, margin:0 }}>{deal.name}</h2>
              <span style={{ background:stage?.color+'22', color:stage?.color, fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>{stage?.name || deal.stage}</span>
            </div>
            <div style={{ fontSize:13, color:'#888' }}>{contact?.name} {contact?.company ? `· ${contact.company}` : ''}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onEdit} style={{ background:'#f5f5f0', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>✏ Edit</button>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#aaa' }}>✕</button>
          </div>
        </div>

        <div style={{ padding:'22px 28px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

          {/* Left: Deal Info */}
          <div>
            <h4 style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Deal Details</h4>
            {[
              ['💰 Value', fmt$(deal.value)],
              ['📊 Probability', `${deal.probability || 0}%`],
              ['📅 Close Date', deal.close_date || '—'],
              ['👤 Contact', contact?.name || '—'],
              ['🏢 Company', contact?.company || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f5f5f0' }}>
                <span style={{ fontSize:13, color:'#888' }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{value}</span>
              </div>
            ))}

            {/* Probability bar */}
            <div style={{ marginTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:11, color:'#aaa', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Win Probability</span>
                <span style={{ fontSize:11, fontWeight:700, color:'#ff7a59' }}>{deal.probability || 0}%</span>
              </div>
              <div style={{ height:6, background:'#f0ede8', borderRadius:4 }}>
                <div style={{ height:'100%', width:`${deal.probability||0}%`, background:'#ff7a59', borderRadius:4, transition:'width 0.3s' }} />
              </div>
            </div>

            {/* Move stage */}
            <div style={{ marginTop:20 }}>
              <h4 style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Move to Stage</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {stages.map(s => (
                  <button key={s.id} onClick={() => onStageChange(deal.id, s.id, s.name)}
                    style={{ padding:'5px 11px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'inherit',
                      background: s.id === deal.stage_id ? s.color : s.color+'22',
                      color: s.id === deal.stage_id ? '#fff' : s.color,
                      transition:'all 0.15s' }}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Activity timeline */}
          <div>
            <h4 style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Activity ({dealActivities.length})</h4>
            {dealActivities.length === 0 && (
              <div style={{ textAlign:'center', color:'#ccc', padding:'32px 0', fontSize:13 }}>No activity yet</div>
            )}
            <div style={{ maxHeight:320, overflowY:'auto' }}>
              {dealActivities.map((a, i) => (
                <div key={a.id} style={{ display:'flex', gap:12, paddingBottom:16 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:'#fff8f6', border:'1px solid #fce0d8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{ACT_ICONS[a.type]||'⚡'}</div>
                    {i < dealActivities.length-1 && <div style={{ width:2, flex:1, background:'#f0ede8', marginTop:6 }} />}
                  </div>
                  <div style={{ paddingTop:4, flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{a.text}</div>

                    {/* Stage change: show from→to and comment */}
                    {a.type === 'stage_change' && (() => {
                      try {
                        const d = JSON.parse(a.notes || '{}')
                        return (
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                              <span style={{ background:'#f5f5f0', padding:'2px 8px', borderRadius:10, fontSize:11, color:'#666' }}>{d.from}</span>
                              <span style={{ color:'#ccc' }}>→</span>
                              <span style={{ background:'#fff3e0', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700, color:'#ff7a59' }}>{d.to}</span>
                            </div>
                            {d.comment && <div style={{ fontSize:12, color:'#555', marginTop:5, background:'#f9f8f6', padding:'6px 10px', borderRadius:8, lineHeight:1.5 }}>{d.comment}</div>}
                          </div>
                        )
                      } catch(e) { return null }
                    })()}

                    {/* Regular notes */}
                    {a.type !== 'stage_change' && a.notes && (
                      <div style={{ fontSize:12, color:'#666', marginTop:3, lineHeight:1.5, background:'#f9f8f6', padding:'6px 10px', borderRadius:8 }}>{a.notes}</div>
                    )}

                    {/* Follow-up */}
                    {a.follow_up_action && (
                      <div style={{ marginTop:6, background: a.follow_up_done ? '#e8f5e9' : (a.follow_up_date && new Date(a.follow_up_date) < new Date() ? '#fce4ec' : '#fff8f0'),
                        border: `1px solid ${a.follow_up_done ? '#c8e6c9' : (a.follow_up_date && new Date(a.follow_up_date) < new Date() ? '#f8bbd0' : '#ffe0b2')}`,
                        borderRadius:6, padding:'5px 9px', fontSize:11 }}>
                        {a.follow_up_done ? '✅' : (a.follow_up_date && new Date(a.follow_up_date) < new Date() ? '🔴' : '📌')} {a.follow_up_action}
                        {a.follow_up_date && <span style={{ color:'#aaa', marginLeft:6 }}>· due {new Date(a.follow_up_date).toLocaleDateString()}</span>}
                      </div>
                    )}
                    <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>{timeAgo(a.activity_at || a.created_at)}{a.duration_mins ? ` · ${a.duration_mins}min` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        {deal.notes && (
          <div style={{ padding:'0 28px 22px' }}>
            <h4 style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Notes</h4>
            <div style={{ background:'#f9f8f6', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#555', lineHeight:1.6 }}>{deal.notes}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stage Legend ─────────────────────────────────────────────
const StageLegend = ({ stages }) => (
  <div style={{ marginTop:28, background:'#fff', border:'1px solid #e8e5e0', borderRadius:12, padding:'16px 20px' }}>
    <h4 style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:14 }}>Stage Guide</h4>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
      {stages.map((s, i) => (
        <div key={s.id} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ width:28, height:28, borderRadius:8, background:s.color+'22', border:`1px solid ${s.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, fontWeight:800, color:s.color }}>{i+1}</div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontWeight:700, fontSize:13, color:'#1a1a1a' }}>{s.name}</span>
              {s.is_won  && <span style={{ background:'#e8f5e9', color:'#2e7d32', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10, textTransform:'uppercase' }}>Won</span>}
              {s.is_lost && <span style={{ background:'#fce4ec', color:'#c62828', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10, textTransform:'uppercase' }}>Lost</span>}
              {s.is_default && <span style={{ background:'#e3f2fd', color:'#1565c0', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10, textTransform:'uppercase' }}>Default</span>}
            </div>
            {s.description && <div style={{ fontSize:11, color:'#999', marginTop:2, lineHeight:1.4 }}>{s.description}</div>}
          </div>
        </div>
      ))}
    </div>
  </div>
)

// ─── Main Pipeline Component ──────────────────────────────────
export default function Pipeline({ deals, stages, contacts, activities, userCan, user, onNewDeal, onEditDeal, onRefresh }) {
  const [dragDeal,      setDragDeal]      = useState(null)
  const [dragOver,      setDragOver]      = useState(null)
  const [selectedDeal,  setSelectedDeal]  = useState(null)
  const [stageChange,   setStageChange]   = useState(null) // { deal, fromStage, toStage }
  const [changeSaving,  setChangeSaving]  = useState(false)

  const handleDragStart = (e, deal) => {
    setDragDeal(deal)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, stageId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(stageId)
  }

  const handleDrop = (e, stage) => {
    e.preventDefault()
    setDragOver(null)
    if (!dragDeal || dragDeal.stage_id === stage.id) { setDragDeal(null); return }
    const fromStage = stages.find(s => s.id === dragDeal.stage_id)
    setStageChange({ deal: dragDeal, fromStage, toStage: stage })
    setDragDeal(null)
  }

  const handleStageChange = (dealId, stageId, stageName) => {
    const deal = deals.find(d => d.id === dealId)
    const fromStage = stages.find(s => s.id === deal?.stage_id)
    const toStage = stages.find(s => s.id === stageId)
    if (deal && fromStage?.id !== toStage?.id) {
      setStageChange({ deal, fromStage, toStage })
      if (selectedDeal?.id === dealId) setSelectedDeal(null)
    }
  }

  const confirmStageChange = async (notes) => {
    if (!stageChange) return
    setChangeSaving(true)
    const { deal, fromStage, toStage } = stageChange
    // Update the deal stage
    await supabase.from('deals').update({ stage_id: toStage.id, stage: toStage.name }).eq('id', deal.id)
    // Create a stage_change activity linked to the deal
    await supabase.from('activities').insert({
      workspace_id: deal.workspace_id,
      deal_id:      deal.id,
      contact_id:   deal.contact_id || null,
      created_by:   user?.id,
      type:         'stage_change',
      text:         `Stage changed: ${fromStage?.name} → ${toStage?.name}`,
      notes:        JSON.stringify({ from: fromStage?.name, to: toStage?.name, comment: notes }),
      activity_at:  new Date().toISOString(),
    })
    setChangeSaving(false)
    setStageChange(null)
    onRefresh()
  }

  const sortedStages = [...stages].sort((a, b) => a.position - b.position)

  return (
    <div style={{ animation:'fadeUp 0.3s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:24, margin:0 }}>Pipeline</h1>
          <p style={{ color:'#888', fontSize:13, margin:'4px 0 0' }}>{deals.length} deals · drag cards to move between stages</p>
        </div>
        {userCan('deals','create') && <button className="btn-primary" onClick={onNewDeal}>+ New Deal</button>}
      </div>

      {/* Kanban board */}
      <div style={{ display:'flex', gap:14, overflowX:'auto', paddingBottom:16, alignItems:'flex-start' }}>
        {sortedStages.map(stage => {
          const stageDeals = deals.filter(d => d.stage_id === stage.id || d.stage === stage.name)
          const total = stageDeals.reduce((s, d) => s + Number(d.value || 0), 0)
          const isOver = dragOver === stage.id

          return (
            <div key={stage.id}
              onDragOver={e => handleDragOver(e, stage.id)}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, stage)}
              style={{ minWidth:230, flex:'0 0 230px', transition:'all 0.15s' }}>

              {/* Stage header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, padding:'0 2px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:stage.color }} />
                  <span style={{ fontWeight:700, fontSize:13, color:'#333' }}>{stage.name}</span>
                </div>
                <span style={{ background:stage.color+'22', color:stage.color, borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{stageDeals.length}</span>
              </div>
              {total > 0 && <div style={{ fontSize:12, color:stage.color, fontWeight:700, marginBottom:8, paddingLeft:2 }}>{fmt$(total)}</div>}

              {/* Drop zone */}
              <div style={{ minHeight:80, borderRadius:12, border: isOver ? `2px dashed ${stage.color}` : '2px dashed transparent', background: isOver ? stage.color+'11' : 'transparent', transition:'all 0.15s', padding:2 }}>

                {stageDeals.map(d => {
                  const c = contacts.find(x => x.id === d.contact_id)
                  return (
                    <div key={d.id}
                      draggable={userCan('deals','edit_any') || userCan('deals','edit_own')}
                      onDragStart={e => handleDragStart(e, d)}
                      onClick={() => setSelectedDeal(d)}
                      style={{ background:'#fff', border:'1px solid #e8e5e0', borderRadius:10, padding:14, marginBottom:8, cursor:'pointer', transition:'all 0.15s', userSelect:'none' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,0,0.08)'; e.currentTarget.style.transform='translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none' }}>
                      <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{d.name}</div>
                      <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>{c?.name || '—'}{c?.company ? ` · ${c.company}` : ''}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:14, color:'#ff7a59' }}>{fmt$(d.value)}</span>
                        <span style={{ fontSize:11, color:'#bbb' }}>{d.close_date || ''}</span>
                      </div>
                      <div style={{ height:4, background:'#f0ede8', borderRadius:3 }}>
                        <div style={{ height:'100%', width:`${d.probability||0}%`, background:stage.color, borderRadius:3 }} />
                      </div>
                      <div style={{ fontSize:10, color:'#bbb', marginTop:4, textAlign:'right' }}>{d.probability||0}% probability</div>
                    </div>
                  )
                })}

                {stageDeals.length === 0 && !isOver && (
                  <div style={{ border:'2px dashed #e8e5e0', borderRadius:10, padding:'24px 12px', textAlign:'center', color:'#ccc', fontSize:12 }}>
                    Drop here
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Stage legend */}
      <StageLegend stages={sortedStages} />

      {/* Stage change note modal */}
      {stageChange && (
        <StageChangeModal
          deal={stageChange.deal}
          fromStage={stageChange.fromStage}
          toStage={stageChange.toStage}
          saving={changeSaving}
          onConfirm={confirmStageChange}
          onCancel={() => { setStageChange(null); setDragDeal(null) }}
        />
      )}

      {/* Deal detail modal */}
      {selectedDeal && (
        <DealModal
          deal={selectedDeal}
          contact={contacts.find(c => c.id === selectedDeal.contact_id)}
          stage={stages.find(s => s.id === selectedDeal.stage_id)}
          stages={sortedStages}
          activities={activities}
          onClose={() => setSelectedDeal(null)}
          onEdit={() => { onEditDeal(selectedDeal); setSelectedDeal(null) }}
          onStageChange={handleStageChange}
        />
      )}
    </div>
  )
}
