import { describe, expect, it } from 'vitest'

import { assignableRoles, canManageMember, inBabyScope, isManager } from './roles'

describe('family roles', () => {
  it('lets owners and admins manage', () => {
    expect(isManager('owner')).toBe(true)
    expect(isManager('admin')).toBe(true)
    expect(isManager('caregiver')).toBe(false)
  })

  it('lets owners manage everyone else and admins manage non-admins', () => {
    expect(canManageMember('owner', 'admin')).toBe(true)
    expect(canManageMember('owner', 'owner')).toBe(false)
    expect(canManageMember('admin', 'caregiver')).toBe(true)
    expect(canManageMember('admin', 'caregiver', 'admin')).toBe(false)
    expect(canManageMember('admin', 'admin')).toBe(false)
    expect(canManageMember('caregiver', 'viewer')).toBe(false)
  })

  it('offers the roles an actor can hand out', () => {
    expect(assignableRoles('owner')).toEqual(['admin', 'caregiver', 'viewer'])
    expect(assignableRoles('admin')).toEqual(['caregiver', 'viewer'])
    expect(assignableRoles('viewer')).toEqual([])
  })

  it('checks baby scopes given as sets or lists', () => {
    expect(inBabyScope(null, 'a')).toBe(true)
    expect(inBabyScope(['a'], 'a')).toBe(true)
    expect(inBabyScope(new Set(['a']), 'b')).toBe(false)
  })
})
