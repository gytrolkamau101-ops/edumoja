import { supabase } from '../supabaseClient'

export async function publishParentPost({
  schoolId,
  userId,
  postType,
  title,
  text,
  studentId = null,
  extra = {},
}) {
  const body = {
    text: (text || '').trim(),
    ...extra,
  }
  const { data, error } = await supabase
    .from('parent_portal_posts')
    .insert({
      school_id: schoolId,
      student_id: studentId || null,
      post_type: postType,
      title: (title || postType).trim(),
      body,
      published_by: userId || null,
      is_active: true,
    })
    .select('id')
    .maybeSingle()
  return { data, error }
}

export async function recallParentPost(id) {
  return supabase.from('parent_portal_posts').update({ is_active: false }).eq('id', id)
}

export async function listParentPosts(schoolId, postType = null, limit = 30) {
  let q = supabase
    .from('parent_portal_posts')
    .select('id, post_type, title, body, published_at, is_active, student_id')
    .eq('school_id', schoolId)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (postType) q = q.eq('post_type', postType)
  return q
}
