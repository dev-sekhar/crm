// src/StageManager.jsx
// Editable deal stage workflow — used as a tab in Team Settings
import { useState } from 'react'
import { supabase } from './supabaseClient'

const STAGE_COLORS = [
  '#888888','#3949ab','#1565c0','#00838f','#2e7d32',
  '#f57f17','#e65100','#ff7a59','#c62828','#6a1a6a'
]

const ColorPicker = ({ value, onChange }) => (
  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
    {STAGE_COLORS.map(c => (
      <button key={c} onClick={() => onChange(c)}
        style={{ width:22, height:22, borderRadius:'50%', background:c, border: value===c ? '3px solid #1a1a1a' : '2px solid transparent', cursor:'pointer', padding:0, transition:'all 0.15s' }} />
    ))}
  </div>
)

export default function StageManager({ workspace, stages: initialStages, canEdit, onRefresh }) {
  const [stages, setStages]     = useState([...initialStages].sort((a,b) => a.position - b.position))
  const [editing, setEditing]   = useState(null)   // stage id being edited
  const [adding,  setAdding]    = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [toast,   setToast]     = useState(null)
  const [newStage, setNewStage] = useState({ name:'', description:'', color:'#3949ab', is_won:false, is_lost:false, is_default:false })

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2200) }

  const saveEdit = async (stage) => {
    setSaving(true)
    const { error } = await supabase.from('deal_stages')
      .update({ name: stage.name, description: stage.description, color: stage.color, is_won: stage.is_won, is_lost: stage.is_lost, is_default: stage.is_default })
      .eq('id', stage.id)
    setSaving(false)
    if (error) return showToast('Error: ' + error.message)
    setEditing(null)
    showToast('Stage saved ✓')
    onRefresh()
  }

  const addStage = async () => {
    if (!newStage.name) return
    setSaving(true)
    const maxPos = Math.max(...stages.map(s => s.position), -1)
    const { error } = await supabase.from('deal_stages')
      .insert({ ...newStage, workspace_id: workspace.id, position: maxPos + 1 })
    setSaving(false)
    if (error) return showToast('Error: ' + error.message)
    setAdding(false)
    setNewStage({ name:'', description:'', color:'#3949ab', is_won:false, is_lost:false, is_default:false })
    showToast('Stage added ✓')
    onRefresh()
  }

  const deleteStage = async (id, name) => {
    const dealsInStage = await supabase.from('deals').select('id').eq('stage_id', id).eq('workspace_id', workspace.id)
    if (dealsInStage.data?.length > 0) {
      return showToast(`Cannot delete "${name}" — ${dealsInStage.data.length} deal(s) are in this stage.`)
    }
    if (!window.confirm(`Delete stage "${name}"? This cannot be undone.`)) return
    await supabase.from('deal_stages').delete().eq('id', id)
    showToast('Stage deleted')
    onRefresh()
  }

  const moveStage = async (index, dir) => {
    const newStages = [...stages]
    const swapIdx = index + dir
    if (swapIdx < 0 || swapIdx >= newStages.length) return
    // Swap positions
    const tmp = newStages[index].position
    newStages[index] = { ...newStages[index], position: newStages[swapIdx].position }
    newStages[swapIdx] = { ...newStages[swapIdx], position: tmp }
    setStages(newStages.sort((a,b) => a.position - b.position))
    // Persist
    await Promise.all([
      supabase.from('deal_stages').update({ position: newStages[index].position }).eq('id', newStages[index].id),
      supabase.from('deal_stages').update({ position: newStages[swapIdx].position }).eq('id', newStages[swapIdx].id),
    ])
    onRefresh()
  }

  const inp = { border:'1px solid #e0ddd8', borderRadius:8, padding:'8px 12px', fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' }
  const label = { display:'block', fontSize:10, fontWeight:700, color:'#aaa', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }

  const StageRow = ({ stage, index }) => {
    const isEditing = editing === stage.id
    const [draft, setDraft] = useState({ ...stage })
    const setD = k => e => setDraft(p => ({ ...p, [k]: e.target.value }))
    const setB = k => e => setDraft(p => ({ ...p, [k]: e.target.checked }))

    return (
      <div style={{ background: isEditing ? '#fff' : '#fff', border: isEditing ? '2px solid #ff7a59' : '1px solid #e8e5e0', borderRadius:12, overflow:'hidden', transition:'border 0.15s' }}>
        {/* Row header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px' }}>
          {/* Drag handle + order */}
          <div style={{ display:'flex', flexDirection:'column', gap:3, opacity:0.3 }}>
            <button onClick={() => moveStage(index, -1)} disabled={index===0} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, opacity:index===0?0.3:1 }}>▲</button>
            <button onClick={() => moveStage(index, 1)} disabled={index===stages.length-1} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, opacity:index===stages.length-1?0.3:1 }}>▼</button>
          </div>
          <div style={{ width:32, height:32, borderRadius:8, background:stage.color+'22', border:`1px solid ${stage.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:stage.color, fontSize:13, flexShrink:0 }}>{index+1}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:14, color:'#1a1a1a' }}>{stage.name}</span>
              {stage.is_won  && <span style={{ background:'#e8f5e9', color:'#2e7d32', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:10, textTransform:'uppercase' }}>Won</span>}
              {stage.is_lost && <span style={{ background:'#fce4ec', color:'#c62828', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:10, textTransform:'uppercase' }}>Lost</span>}
              {stage.is_default && <span style={{ background:'#e3f2fd', color:'#1565c0', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:10, textTransform:'uppercase' }}>Default</span>}
            </div>
            {stage.description && <div style={{ fontSize:12, color:'#aaa', marginTop:2 }}>{stage.description}</div>}
          </div>
          {canEdit && !isEditing && (
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setEditing(stage.id)} style={{ background:'#f5f5f0', border:'none', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', color:'#444' }}>✏ Edit</button>
              <button onClick={() => deleteStage(stage.id, stage.name)} style={{ background:'#fce4ec', border:'none', borderRadius:8, padding:'6px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit', color:'#c62828' }}>🗑</button>
            </div>
          )}
          {isEditing && (
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setEditing(null)} style={{ background:'transparent', border:'1px solid #e0ddd8', borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit', color:'#444' }}>Cancel</button>
              <button onClick={() => saveEdit(draft)} disabled={saving} style={{ background:'#ff7a59', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Save</button>
            </div>
          )}
        </div>

        {/* Edit form */}
        {isEditing && (
          <div style={{ borderTop:'1px solid #f0ede8', padding:'16px 18px', background:'#fafaf8', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <div style={label}>Stage Name</div>
              <input value={draft.name} onChange={setD('name')} style={inp} />
            </div>
            <div>
              <div style={label}>Description</div>
              <input value={draft.description||''} onChange={setD('description')} placeholder="What does this stage mean?" style={inp} />
            </div>
            <div>
              <div style={label}>Colour</div>
              <ColorPicker value={draft.color} onChange={c => setDraft(p => ({ ...p, color: c }))} />
            </div>
            <div>
              <div style={label}>Flags</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                {[['is_default','⭐ Default stage for new deals'],['is_won','🏆 Marks deal as Won'],['is_lost','❌ Marks deal as Lost']].map(([key,lbl]) => (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#555' }}>
                    <input type="checkbox" checked={draft[key]||false} onChange={setB(key)} style={{ accentColor:'#ff7a59' }} />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18, margin:0 }}>Deal Stages</h3>
          <p style={{ fontSize:13, color:'#888', margin:'4px 0 0' }}>Define the workflow for deals through your pipeline · drag to reorder</p>
        </div>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} style={{ background:'#ff7a59', color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Stage</button>
        )}
      </div>

      {/* Stage list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {stages.map((stage, index) => (
          <StageRow key={stage.id} stage={stage} index={index} />
        ))}
      </div>

      {/* Add stage form */}
      {adding && (
        <div style={{ marginTop:12, background:'#fff', border:'2px dashed #ff7a59', borderRadius:12, padding:20 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:'#ff7a59' }}>New Stage</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <div style={label}>Stage Name *</div>
              <input value={newStage.name} onChange={e => setNewStage(p=>({...p,name:e.target.value}))} placeholder="e.g. Demo Scheduled" style={inp} />
            </div>
            <div>
              <div style={label}>Description</div>
              <input value={newStage.description} onChange={e => setNewStage(p=>({...p,description:e.target.value}))} placeholder="What happens in this stage?" style={inp} />
            </div>
            <div>
              <div style={label}>Colour</div>
              <ColorPicker value={newStage.color} onChange={c => setNewStage(p=>({...p,color:c}))} />
            </div>
            <div>
              <div style={label}>Flags</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                {[['is_default','⭐ Default for new deals'],['is_won','🏆 Won'],['is_lost','❌ Lost']].map(([key,lbl]) => (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#555' }}>
                    <input type="checkbox" checked={newStage[key]||false} onChange={e => setNewStage(p=>({...p,[key]:e.target.checked}))} style={{ accentColor:'#ff7a59' }} />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={() => setAdding(false)} style={{ background:'transparent', border:'1px solid #e0ddd8', borderRadius:8, padding:'7px 16px', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'#444' }}>Cancel</button>
            <button onClick={addStage} disabled={saving||!newStage.name} style={{ background:'#ff7a59', color:'#fff', border:'none', borderRadius:8, padding:'7px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:newStage.name?1:0.6 }}>
              {saving ? 'Adding…' : 'Add Stage'}
            </button>
          </div>
        </div>
      )}

      {/* Flow preview */}
      <div style={{ marginTop:24, background:'#fff', border:'1px solid #e8e5e0', borderRadius:12, padding:'14px 20px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Workflow Preview</div>
        <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:0 }}>
          {stages.map((s, i) => (
            <div key={s.id} style={{ display:'flex', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:s.color+'18', borderRadius:20, border:`1px solid ${s.color}44` }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:s.color }} />
                <span style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.name}</span>
              </div>
              {i < stages.length-1 && <span style={{ color:'#ccc', margin:'0 4px', fontSize:16 }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {toast && <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'10px 22px', borderRadius:10, fontSize:13, fontWeight:600, zIndex:9999 }}>{toast}</div>}
    </div>
  )
}
