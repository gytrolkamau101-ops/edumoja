/**
 * EduMoja moat — structured school events for future products.
 * Never log full fee money movement off-platform; only operational facts.
 * Respect RLS: inserts use authenticated school scope.
 */
import { supabase } from '../supabaseClient'

/** @typedef {'school.activated'|'school.suspended'|'fee.payment'|'learner.admitted'|'learner.promoted'|'exam.recorded'|'parent.approved'|'plan.changed'|'attendance.marked'} MoatEventType */

/**
 * Fire-and-forget event. Safe to call from UI; failures are silent.
 * @param {object} opts
 * @param {string} [opts.schoolId]
 * @param {MoatEventType|string} opts.eventType
 * @param {string} [opts.entity]
 * @param {string} [opts.entityId]
 * @param {object} [opts.payload]
 */
export async function logMoatEvent({ schoolId, eventType, entity, entityId, payload }) {
  if (!schoolId || !eventType) return
  try {
    await supabase.from('school_events').insert({
      school_id: schoolId,
      event_type: String(eventType).slice(0, 80),
      entity: entity ? String(entity).slice(0, 40) : null,
      entity_id: entityId || null,
      payload: payload || {},
    })
  } catch (_) {
    /* table may not exist until migration 045 */
  }
}
