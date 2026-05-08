'use strict';
/* ══════════════════════════════════════════════════════════════════════════════
   FIREBASE REALTIME DATABASE — config & helpers
   ──────────────────────────────────────────────────────────────────────────────
   SETUP STEPS (one-time):
   1. Go to https://console.firebase.google.com
   2. Create a project (or use existing)
   3. Left sidebar → Build → Realtime Database → Create database (start in test mode)
   4. Left sidebar → Project Settings → General → scroll to "Your apps"
      → Add app (Web) → copy the firebaseConfig object values below
   5. Realtime Database → Rules → paste and Publish:
      {
        "rules": { ".read": true, ".write": true }
      }
   ══════════════════════════════════════════════════════════════════════════════ */

const _FB_CFG = {
  apiKey: "AIzaSyA5NbMY-U5y9IHKe9Vm-6jCJF2LNYsmbWY",
    authDomain: "startingtogether-aa612.firebaseapp.com",
    projectId: "startingtogether-aa612",
    storageBucket: "startingtogether-aa612.firebasestorage.app",
    messagingSenderId: "657989094316",
    databaseURL:       "https://startingtogether-aa612-default-rtdb.firebaseio.com",
    appId: "1:657989094316:web:4a2dcebaed56a85ce20809"
};

/* ── Init (guard against double-init on hot-reload) ── */
try {
  if (!firebase.apps.length) firebase.initializeApp(_FB_CFG);
  window.FBDB = firebase.database();
} catch(e) {
  console.warn('[Firebase] init failed — running in offline/localStorage mode.', e.message);
  window.FBDB = null;
}

/* ── Internal helpers ── */
function _fbSanitize(email){ return email.replace(/[.@]/g, '_'); }
function _fbRoot(){
  if(!window.FBDB) return null;
  const email = getMentorEmail();
  return email ? `mty/${_fbSanitize(email)}` : null;
}

/* ── fbWrite: called by setData() to mirror every local write to Firebase ── */
function fbWrite(key, val){
  const root = _fbRoot();
  if(!root) return;
  FBDB.ref(`${root}/${key}`).set(JSON.stringify(val))
    .catch(e => console.warn('[Firebase] write error:', e.message));
}

/* ── fbSync: pull one or more keys from Firebase, update localStorage, call cb ── */
function fbSync(keys, cb){
  const root = _fbRoot();
  if(!root){ cb({}); return; }
  const result = {};
  let pending = keys.length;
  const done = () => { if(--pending === 0) cb(result); };

  keys.forEach(key => {
    FBDB.ref(`${root}/${key}`).once('value', snap => {
      try {
        const raw = snap.val();
        if(raw){
          const arr = JSON.parse(raw);
          if(Array.isArray(arr) && arr.length){
            /* Version guard: skip stale chats */
            if(key === 'chats' && typeof CHATS_V !== 'undefined' && arr[0]._v !== CHATS_V){
              /* ignore — local buildChats() will rebuild correctly */
            } else {
              /* Write directly to localStorage without triggering fbWrite again */
              localStorage.setItem(_storageKey(key), raw);
              result[key] = arr;
            }
          }
        }
      } catch(e){ console.warn('[Firebase] sync parse error', e); }
      done();
    }, () => done()); /* error callback — just skip this key */
  });
}

/* ── fbSeedIfEmpty: called once on mentor login — pushes local data to Firebase
   if Firebase has nothing (or stale chats) for this mentor's namespace ── */
function fbSeedIfEmpty(){
  const root = _fbRoot();
  if(!root) return;
  ['chats','faqs','anns'].forEach(key => {
    FBDB.ref(`${root}/${key}`).once('value', snap => {
      let needsSeed = !snap.val();
      /* Also reseed if chats version is stale */
      if(!needsSeed && key==='chats'){
        try{
          const arr=JSON.parse(snap.val());
          if(!arr||!arr[0]||arr[0]._v!==CHATS_V) needsSeed=true;
        }catch(e){ needsSeed=true; }
      }
      if(needsSeed){
        const data=getData(key);
        if(data&&data.length){
          FBDB.ref(`${root}/${key}`).set(JSON.stringify(data))
            .then(()=>console.log(`[Firebase] seeded "${key}" (${data.length} items)`))
            .catch(e=>console.warn('[Firebase] seed error:',e.message));
        }
      }
    });
  });
}

/* ── fbListen: real-time listener — fires whenever another client writes ── */
function fbListen(key, cb){
  const root = _fbRoot();
  if(!root) return;
  FBDB.ref(`${root}/${key}`).on('value', snap => {
    try {
      const raw = snap.val();
      if(!raw) return;
      const arr = JSON.parse(raw);
      if(Array.isArray(arr) && arr.length){
        /* Update localStorage silently (don't write back to Firebase) */
        localStorage.setItem(_storageKey(key), raw);
        cb(arr);
      }
    } catch(e){}
  });
}
