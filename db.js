'use strict';

/*
  User database — populated via the admin panel (admin.html).
  No hardcoded users. All data lives in Firebase under _db/mentors & _db/students
  and is cached in localStorage (_dyn_mentors / _dyn_students) after each login.
*/

const DB_MENTORS  = [];   /* intentionally empty — do not add users here */
const DB_STUDENTS = [];   /* intentionally empty — do not add users here */

/* ── Colour palette used when generating avatars for dynamic users ── */
const _PALETTE = [
  '#3EA9A3','#3B82F6','#8B5CF6','#F59E0B','#EF4444',
  '#10B981','#F97316','#6366F1','#EC4899','#14B8A6'
];

/* ── Helpers: read dynamic DB from localStorage cache ── */
function _parseDyn(key){
  try{ const r=localStorage.getItem(key); return r?JSON.parse(r):null; }catch(e){return null;}
}
/* Returns Firebase-uploaded users, or empty array if none uploaded yet */
function getMentorsDB()  { return _parseDyn('_dyn_mentors')  || []; }
function getStudentsDB() { return _parseDyn('_dyn_students') || []; }
function getMentorObjByEmail(email){
  return getMentorsDB().find(m=>m.e===email) || null;
}
