// src/TeamSettings.jsx
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import {
  RESOURCES, RESOURCE_ACTIONS, ALL_ACTIONS, ACTION_LABELS,
  ROLES, ROLE_COLORS, getRoleColor,
  LOCKED_ROLES, TEAM_SETTINGS_ROLES,
  DEFAULT_JOIN_ROLE, isLockedRole, canAccessTeamSettings,
  usePermissions
} from './permissions'

// Constants imported from permissions.js

const Modal = ({ title, onClose, children, width = 560 }) => (
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'popIn 0.18s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f0ede8' }}>
        <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 18 }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa' }}>✕</button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
)

// ─── Permission Matrix ────────────────────────────────────────
const PermissionMatrix = ({ permissions, onChange, disabled }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f5f5f0', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', borderRadius: '8px 0 0 8px' }}>Resource</th>
          {ALL_ACTIONS.map(a => (
            <th key={a} style={{ padding: '8px 8px', background: '#f5f5f0', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', fontSize: 10 }}>{ACTION_LABELS[a]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {RESOURCES.map((resource, ri) => (
          <tr key={resource} style={{ background: ri % 2 === 0 ? '#fff' : '#fafaf8' }}>
            <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13, color: '#1a1a1a', textTransform: 'capitalize' }}>{resource}</td>
            {ALL_ACTIONS.map(action => {
              const applicable = RESOURCE_ACTIONS[resource].includes(action)
              const checked = permissions[`${resource}:${action}`] || false
              return (
                <td key={action} style={{ textAlign: 'center', padding: '10px 8px' }}>
                  {applicable ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={e => onChange(`${resource}:${action}`, e.target.checked)}
                      style={{ width: 15, height: 15, cursor: disabled ? 'not-allowed' : 'pointer', accentColor: '#ff7a59' }}
                    />
                  ) : (
                    <span style={{ color: '#e0ddd8', fontSize: 16 }}>—</span>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ─── Role Card ────────────────────────────────────────────────
const RoleCard = ({ role, permissions, memberCount, canEdit, onEdit, onDelete }) => {
  const permCount = Object.values(permissions).filter(Boolean).length
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e5e0', borderRadius: 12, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: getRoleColor(role.name), flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{role.name}</span>
          {role.is_default && <span style={{ background: '#f0ede8', color: '#888', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase' }}>Default</span>}
        </div>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 8px 20px' }}>{role.description || 'No description'}</p>
        <div style={{ display: 'flex', gap: 12, marginLeft: 20 }}>
          <span style={{ fontSize: 12, color: '#aaa' }}>👤 {memberCount} member{memberCount !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12, color: '#aaa' }}>🔑 {permCount} permission{permCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onEdit} style={{ background: '#f5f5f0', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#444' }}>✏ Edit</button>
          {!role.is_default && <button onClick={onDelete} style={{ background: '#fce4ec', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#c62828' }}>🗑</button>}
        </div>
      )}
    </div>
  )
}

// ─── Main TeamSettings Component ──────────────────────────────
export default function TeamSettings({ workspace, currentUser, onClose }) {
  const [tab, setTab]               = useState('members')
  const [members, setMembers]       = useState([])
  const [roles, setRoles]           = useState([])
  const [permissions, setPermissions] = useState({}) // roleId -> { 'resource:action': bool }
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState(null)
  const [editRole, setEditRole]     = useState(null) // role being edited
  const [newRoleModal, setNewRoleModal] = useState(false)
  const [newRole, setNewRole]       = useState({ name: '', description: '' })
  const [newRolePerms, setNewRolePerms] = useState({})
  const [currentMember, setCurrentMember] = useState(null)
  const { userCan: memberCan, roleName: currentRoleName } = usePermissions(workspace, currentUser)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  // ── Fetch data ───────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true)
    const [{ data: m }, { data: r }, { data: p }] = await Promise.all([
      supabase.from('workspace_members').select('*, roles(id, name, description, is_default)').eq('workspace_id', workspace.id),
      supabase.from('roles').select('*').eq('workspace_id', workspace.id).order('created_at'),
      supabase.from('role_permissions').select('*, roles!inner(workspace_id)').eq('roles.workspace_id', workspace.id),
    ])

    setMembers(m || [])
    setRoles(r || [])

    // Build permissions map: roleId -> { 'resource:action': bool }
    const permMap = {}
    ;(r || []).forEach(role => { permMap[role.id] = {} })
    ;(p || []).forEach(perm => {
      if (permMap[perm.role_id]) {
        permMap[perm.role_id][`${perm.resource}:${perm.action}`] = true
      }
    })
    setPermissions(permMap)

    // Find current user's member record
    const me = (m || []).find(x => x.user_id === currentUser.id)
    setCurrentMember(me)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const canManageRoles   = memberCan('team', 'manage_roles')
  const canManageMembers = memberCan('team', 'remove') || memberCan('team', 'invite')

  // ── Save role permissions ─────────────────────────────────────
  const saveRolePermissions = async (roleId, perms) => {
    setSaving(true)
    // Delete existing permissions for this role
    await supabase.from('role_permissions').delete().eq('role_id', roleId)
    // Insert new ones
    const inserts = Object.entries(perms)
      .filter(([, v]) => v)
      .map(([key]) => {
        const [resource, action] = key.split(':')
        return { role_id: roleId, resource, action }
      })
    if (inserts.length > 0) await supabase.from('role_permissions').insert(inserts)
    setSaving(false)
    showToast('Permissions saved ✓')
    setEditRole(null)
    fetchAll()
  }

  // ── Create new role ───────────────────────────────────────────
  const createRole = async () => {
    if (!newRole.name) return
    setSaving(true)
    const { data: role, error } = await supabase.from('roles')
      .insert({ workspace_id: workspace.id, name: newRole.name, description: newRole.description, is_default: false })
      .select().single()
    if (error) { setSaving(false); return showToast('Error: ' + error.message) }
    // Save permissions
    const inserts = Object.entries(newRolePerms)
      .filter(([, v]) => v)
      .map(([key]) => {
        const [resource, action] = key.split(':')
        return { role_id: role.id, resource, action }
      })
    if (inserts.length > 0) await supabase.from('role_permissions').insert(inserts)
    setSaving(false)
    setNewRoleModal(false)
    setNewRole({ name: '', description: '' })
    setNewRolePerms({})
    showToast('Role created ✓')
    fetchAll()
  }

  // ── Delete role ───────────────────────────────────────────────
  const deleteRole = async (roleId) => {
    if (!window.confirm('Delete this role? Members with this role will have no role assigned.')) return
    await supabase.from('roles').delete().eq('id', roleId)
    showToast('Role deleted')
    fetchAll()
  }

  // ── Update member role ────────────────────────────────────────
  const updateMemberRole = async (memberId, roleId, roleName) => {
    const legacyRole = ['Owner','Admin'].includes(roleName) ? roleName.toLowerCase() : 'member'
    await supabase.from('workspace_members').update({ role_id: roleId, role: legacyRole }).eq('id', memberId)
    showToast('Role updated ✓')
    fetchAll()
  }

  // ── Remove member ─────────────────────────────────────────────
  const removeMember = async (memberId) => {
    if (!window.confirm('Remove this member from the workspace?')) return
    await supabase.from('workspace_members').delete().eq('id', memberId)
    showToast('Member removed')
    fetchAll()
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 18, color: '#ff7a59' }}>Loading team settings…</div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 200 }}>
      <div style={{ width: '80vw', maxWidth: 900, height: '100vh', background: '#f5f5f0', overflowY: 'auto', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', animation: 'slideIn 0.2s ease', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e8e5e0', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 22, color: '#1a1a1a', margin: 0 }}>Team Settings</h2>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>🏢 {workspace.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e8e5e0', padding: '0 28px', display: 'flex', gap: 4 }}>
          {[['members', '👥 Members'], ['roles', '🔑 Roles & Permissions']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', color: tab === id ? '#ff7a59' : '#888', borderBottom: tab === id ? '2px solid #ff7a59' : '2px solid transparent', transition: 'all 0.15s' }}>{label}</button>
          ))}
        </div>

        <div style={{ flex: 1, padding: 28 }}>

          {/* ── MEMBERS TAB ── */}
          {tab === 'members' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 18, margin: 0 }}>Team Members</h3>
                  <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>{members.length} member{members.length !== 1 ? 's' : ''} in this workspace</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {members.map(m => (
                  <div key={m.id} style={{ background: '#fff', border: '1px solid #e8e5e0', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#ff7a59', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                      {(m.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{m.full_name || 'Unnamed'}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{m.user_id === currentUser.id ? '(you)' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {(() => {
                        const memberRoleName = m.roles?.name || m.role || ''
                        const isOwnerRow = isLockedRole(memberRoleName) || m.role === 'owner'
                        const isMe = m.user_id === currentUser.id
                        // Owner role is always locked — show pill only, no dropdown, no remove
                        if (isOwnerRow) return (
                          <span style={{ background: getRoleColor('Owner') + '20', color: getRoleColor('Owner'), fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                            👑 Owner <span style={{ fontSize: 10, opacity: 0.6 }}>· locked</span>
                          </span>
                        )
                        // Editable dropdown for non-owner members (not yourself)
                        if (canManageMembers && !isMe) return (
                          <>
                            <select
                              value={m.role_id || ''}
                              onChange={e => {
                                const role = roles.find(r => r.id === e.target.value)
                                if (role) updateMemberRole(m.id, role.id, role.name)
                              }}
                              style={{ border: '1px solid #e0ddd8', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', outline: 'none' }}
                            >
                              <option value="">No role</option>
                              {roles.filter(r => !isLockedRole(r.name)).map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                            <button onClick={() => removeMember(m.id)} style={{ background: '#fce4ec', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#c62828', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Remove</button>
                          </>
                        )
                        // Read-only pill for everyone else
                        return (
                          <span style={{ background: getRoleColor(memberRoleName) + '20', color: getRoleColor(memberRoleName), fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                            {memberRoleName || 'No role'}{isMe ? ' (you)' : ''}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Invite info */}
              <div style={{ marginTop: 24, background: '#fff', border: '1px solid #e8e5e0', borderRadius: 12, padding: 20 }}>
                <h4 style={{ fontWeight: 700, fontSize: 14, margin: '0 0 8px' }}>Invite teammates</h4>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px', lineHeight: 1.6 }}>Share your workspace slug with teammates. They can join at the registration screen using the "Join existing workspace" option.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <code style={{ background: '#f5f5f0', padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#ff7a59', flex: 1 }}>{workspace.slug}</code>
                  <button onClick={() => { navigator.clipboard.writeText(workspace.slug); showToast('Slug copied ✓') }} style={{ background: '#ff7a59', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Copy slug</button>
                </div>
              </div>
            </div>
          )}

          {/* ── ROLES TAB ── */}
          {tab === 'roles' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 18, margin: 0 }}>Roles & Permissions</h3>
                  <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>{roles.length} roles · click a role to edit its permissions</p>
                </div>
                {canManageRoles && (
                  <button onClick={() => setNewRoleModal(true)} style={{ background: '#ff7a59', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ New Role</button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {roles.map(role => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    permissions={permissions[role.id] || {}}
                    memberCount={members.filter(m => m.role_id === role.id).length}
                    canEdit={canManageRoles && !isLockedRole(role.name)}
                    onEdit={() => setEditRole({ ...role, perms: { ...permissions[role.id] } })}
                    onDelete={() => deleteRole(role.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Role Modal ── */}
      {editRole && (
        <Modal title={`Edit: ${editRole.name}`} onClose={() => setEditRole(null)} width={720}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</label>
            <input
              value={editRole.description || ''}
              onChange={e => setEditRole(p => ({ ...p, description: e.target.value }))}
              disabled={editRole.is_default}
              style={{ width: '100%', border: '1px solid #e0ddd8', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', background: editRole.is_default ? '#f5f5f0' : '#fff', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Permissions</label>
            <PermissionMatrix
              permissions={editRole.perms || {}}
              onChange={(key, val) => setEditRole(p => ({ ...p, perms: { ...p.perms, [key]: val } }))}
              disabled={false}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditRole(null)} style={{ background: 'transparent', border: '1px solid #e0ddd8', color: '#444', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button disabled={saving} onClick={() => saveRolePermissions(editRole.id, editRole.perms || {})} style={{ background: '#ff7a59', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── New Role Modal ── */}
      {newRoleModal && (
        <Modal title="Create New Role" onClose={() => setNewRoleModal(false)} width={720}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role Name</label>
            <input value={newRole.name} onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Field Agent" style={{ width: '100%', border: '1px solid #e0ddd8', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</label>
            <input value={newRole.description} onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))} placeholder="What does this role do?" style={{ width: '100%', border: '1px solid #e0ddd8', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Permissions</label>
            <PermissionMatrix permissions={newRolePerms} onChange={(key, val) => setNewRolePerms(p => ({ ...p, [key]: val }))} disabled={false} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setNewRoleModal(false)} style={{ background: 'transparent', border: '1px solid #e0ddd8', color: '#444', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button disabled={saving || !newRole.name} onClick={createRole} style={{ background: '#ff7a59', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: (saving || !newRole.name) ? 0.6 : 1, fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : 'Create Role'}
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, pointerEvents: 'none' }}>{toast}</div>}
    </div>
  )
}
