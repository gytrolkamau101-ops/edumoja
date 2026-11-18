import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  planEntitlements,
  canAccessModule,
  canExportReports,
  normalizePlanId,
  DEFAULT_PLANS,
  planDisplayName,
} from '../src/lib/plans.js'

describe('plans v13 Basic / Premium / Pro', () => {
  it('normalizes legacy ids', () => {
    assert.equal(normalizePlanId('basic'), 'starter')
    assert.equal(normalizePlanId('premium'), 'standard')
    assert.equal(normalizePlanId('pro'), 'full')
  })

  it('display names are street labels', () => {
    assert.equal(planDisplayName('basic'), 'Basic')
    assert.equal(planDisplayName('premium'), 'Premium')
    assert.equal(planDisplayName('pro'), 'Pro')
  })

  it('free cannot fees or messages', () => {
    const s = { plan: 'free' }
    assert.equal(canAccessModule(s, 'students'), true)
    assert.equal(canAccessModule(s, 'finance'), false)
    assert.equal(canAccessModule(s, 'messages'), false)
    assert.equal(canExportReports(s), false)
  })

  it('basic has attendance/timetable, not fees', () => {
    const s = { plan: 'basic' }
    assert.equal(planEntitlements(s).planId, 'starter')
    assert.equal(canAccessModule(s, 'attendance'), true)
    assert.equal(canAccessModule(s, 'timetable'), true)
    assert.equal(canAccessModule(s, 'finance'), false)
    assert.equal(canAccessModule(s, 'messages'), false)
    assert.equal(canExportReports(s), false)
  })

  it('premium has fees, school finance, messages; export still Pro', () => {
    const s = { plan: 'premium' }
    assert.equal(planEntitlements(s).planId, 'standard')
    assert.equal(canAccessModule(s, 'finance'), true)
    assert.equal(canAccessModule(s, 'school-finance'), true)
    assert.equal(canAccessModule(s, 'messages'), true)
    assert.equal(canAccessModule(s, 'attendance'), true)
    assert.equal(canExportReports(s), false)
  })

  it('pro has export and full pack', () => {
    const s = { plan: 'pro' }
    assert.equal(planEntitlements(s).planId, 'full')
    assert.equal(canExportReports(s), true)
    assert.equal(canAccessModule(s, 'capitation'), true)
    assert.equal(canAccessModule(s, 'library'), true)
  })

  it('expired paid falls to free', () => {
    const s = { plan: 'pro', plan_expires_at: '2020-01-01T00:00:00Z' }
    assert.equal(planEntitlements(s).planId, 'free')
    assert.equal(planEntitlements(s).expired, true)
  })

  it('default prices are 3k/5k/10k', () => {
    const prices = DEFAULT_PLANS.plans.map((p) => p.price)
    assert.deepEqual(prices, [3000, 5000, 10000])
  })
})
