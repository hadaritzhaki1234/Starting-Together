'use strict';
/* ══════════════════════════════════════════════════════════════════════════════
   FIREBASE REALTIME DATABASE — config & helpers
   ══════════════════════════════════════════════════════════════════════════════ */

const _FB_CFG = {
  apiKey: "AIzaSyA5NbMY-U5y9IHKe9Vm-6jCJF2LNYsmbWY",
  authDomain: "startingtogether-aa612.firebaseapp.com",
  projectId: "startingtogether-aa612",
  storageBucket: "startingtogether-aa612.firebasestorage.app",
  messagingSenderId: "657989094316",
  databaseURL: "https://startingtogether-aa612-default-rtdb.europe-west1.firebasedatabase.app",
  appId: "1:657989094316:web:4a2dcebaed56a85ce20809"
};

/* ── Init (guard against double-init on hot-reload) ── */
_fbSetStatus('connecting'); /* show badge immediately — updated after ping */
try {
  if (!firebase.apps.length) firebase.initializeApp(_FB_CFG);
  window.FBDB = firebase.database();
  console.log('%c[Firebase] ✅ SDK מחובר — בודק כתיבה...', 'color:#16a34a;font-weight:bold');
  /* Self-test: write a timestamp to confirm write access (5s timeout) */
  let _pingDone = false;
  const _pingTimer = setTimeout(() => {
    if(_pingDone) return;
    _pingDone = true;
    console.error('%c[Firebase] ⏱ Timeout — Firebase לא מגיב אחרי 5 שניות.\nייתכן שה-Realtime Database לא פעיל, ה-URL שגוי, או שחומת אש חוסמת את החיבור.', 'color:#dc2626;font-weight:bold');
    _fbSetStatus('write-err');
  }, 5000);

  window.FBDB.ref('_ping').set(Date.now())
    .then(() => {
      if(_pingDone) return;
      _pingDone = true;
      clearTimeout(_pingTimer);
      console.log('%c[Firebase] ✅ כתיבה עובדת! Firebase פעיל לחלוטין', 'color:#16a34a;font-weight:bold;font-size:1.1em');
      _fbSetStatus('ok');
    })
    .catch(e => {
      if(_pingDone) return;
      _pingDone = true;
      clearTimeout(_pingTimer);
      console.error('%c[Firebase] ❌ כתיבה נכשלה — בדוק Rules ב-Firebase Console', 'color:#dc2626;font-weight:bold;font-size:1.1em', e.message);
      _fbSetStatus('write-err');
    });
} catch(e) {
  console.warn('[Firebase] ❌ חיבור נכשל — עובד במצב localStorage בלבד.', e.message);
  window.FBDB = null;
  _fbSetStatus('err');
}

/* ── Visual status badge ── */
function _fbSetStatus(state){
  const cfg = {
    'connecting':{ bg:'#e0f2fe', color:'#0369a1', border:'#7dd3fc', text:'⏳ Firebase...', title:'Firebase מתחבר...' },
    'ok':        { bg:'#dcfce7', color:'#15803d', border:'#86efac', text:'🟢 Firebase', title:'Firebase מחובר וכתיבה עובדת' },
    'err':       { bg:'#fee2e2', color:'#b91c1c', border:'#fca5a5', text:'🔴 Firebase offline', title:'Firebase לא מחובר — מצב offline' },
    'write-err': { bg:'#fef9c3', color:'#854d0e', border:'#fde047', text:'🟡 Firebase — כתיבה חסומה', title:'Firebase מחובר אך כתיבה נכשלת — בדוק Rules' },
  };
  const c = cfg[state] || cfg['err'];
  const inject = () => {
    let el = document.getElementById('fb-status');
    if(!el){
      el = document.createElement('div');
      el.id = 'fb-status';
      el.style.cssText = [
        'position:fixed','bottom:14px','left:14px','z-index:9999',
        'font-size:.65rem','font-weight:700','padding:3px 8px',
        'border-radius:20px','opacity:.85','pointer-events:none',
        'transition:background .4s,color .4s',
        'font-family:Heebo,system-ui,sans-serif'
      ].join(';');
      document.body.appendChild(el);
    }
    el.title = c.title;
    el.style.background = c.bg;
    el.style.color = c.color;
    el.style.border = `1px solid ${c.border}`;
    el.textContent = c.text;
  };
  if(document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);
}

/* ── Internal helpers ── */
function _fbSanitize(email){ return email.replace(/[.@]/g, '_'); }
function _fbRoot(){
  if(!window.FBDB) return null;
  const email = getMentorEmail();
  return email ? `mty/${_fbSanitize(email)}` : null;
}

/* ── fbWrite: mirror every local write to Firebase ── */
function fbWrite(key, val){
  const root = _fbRoot();
  if(!root) return;
  FBDB.ref(`${root}/${key}`).set(JSON.stringify(val))
    .then(() => console.log(`%c[Firebase] ✏️  כתב "${key}" (${Array.isArray(val)?val.length+' פריטים':'ok'})`, 'color:#0284c7'))
    .catch(e => console.warn('[Firebase] ❌ שגיאת כתיבה:', e.message));
}

/* ── fbSync: one-time pull from Firebase → localStorage → callback ── */
function fbSync(keys, cb){
  const root = _fbRoot();
  if(!root){
    console.warn('[Firebase] fbSync: אין root (לא מחובר או לא הוגדר מנטור)');
    cb({});
    return;
  }
  console.log(`%c[Firebase] 🔄 מסנכרן: ${keys.join(', ')}`, 'color:#7c3aed');
  const result = {};
  let pending = keys.length;
  const done = () => {
    if(--pending === 0){
      const loaded = Object.keys(result);
      if(loaded.length){
        console.log(`%c[Firebase] ✅ סנכרון הושלם: ${loaded.map(k=>`${k}(${Array.isArray(result[k])?result[k].length:'?'})`).join(', ')}`, 'color:#16a34a');
      } else {
        console.log('%c[Firebase] ℹ️  סנכרון הסתיים — לא נמצאו נתונים ב-Firebase', 'color:#ca8a04');
      }
      cb(result);
    }
  };

  keys.forEach(key => {
    FBDB.ref(`${root}/${key}`).once('value', snap => {
      try {
        const raw = snap.val();
        if(raw){
          const arr = JSON.parse(raw);
          if(Array.isArray(arr) && arr.length){
            localStorage.setItem(_storageKey(key), raw);
            result[key] = arr;
          }
        } else {
          console.log(`[Firebase] ℹ️  "${key}" — ריק ב-Firebase`);
        }
      } catch(e){ console.warn('[Firebase] שגיאת parse:', e); }
      done();
    }, () => { console.warn(`[Firebase] שגיאה בקריאת "${key}"`); done(); });
  });
}

/* ── fbSeedIfEmpty: called once on mentor login ── */
/* Only seeds a key if it is completely absent from Firebase — never overwrites existing data */
function fbSeedIfEmpty(){
  const root = _fbRoot();
  if(!root) return;
  ['chats','faqs','anns'].forEach(key => {
    FBDB.ref(`${root}/${key}`).once('value', snap => {
      const existing = snap.val();
      if(existing){
        console.log(`[Firebase] ℹ️  "${key}" כבר קיים ב-Firebase — לא מדרס`);
        return;
      }
      /* Truly empty — seed with local defaults */
      const data = getData(key);
      if(data && data.length){
        FBDB.ref(`${root}/${key}`).set(JSON.stringify(data))
          .then(()=>console.log(`%c[Firebase] 🌱 זרע "${key}" (${data.length} פריטים)`, 'color:#16a34a'))
          .catch(e=>console.warn('[Firebase] שגיאת seeding:',e.message));
      }
    });
  });
}

/* ── fbListen: real-time listener on namespaced key ── */
function fbListen(key, cb){
  const root = _fbRoot();
  if(!root) return;
  console.log(`%c[Firebase] 👂 מאזין ל: "${key}"`, 'color:#7c3aed');
  FBDB.ref(`${root}/${key}`).on('value', snap => {
    try {
      const raw = snap.val();
      if(!raw) return;
      const arr = JSON.parse(raw);
      if(Array.isArray(arr) && arr.length){
        localStorage.setItem(_storageKey(key), raw);
        console.log(`%c[Firebase] 📡 עדכון חי: "${key}" — ${arr.length} פריטים`, 'color:#0891b2');
        cb(arr);
      }
    } catch(e){}
  });
}

/* ════════════════════════════════════════════════════════
   PATH-BASED HELPERS — for multi-mentor student chats
   (operate on absolute Firebase paths, no namespace wrapping)
   ════════════════════════════════════════════════════════ */

/* Public sanitizer — used by student.html to build paths */
function fbSanitize(email){ return _fbSanitize(email); }

/* One-time read from an absolute path; cb(parsedArray | null) */
function fbSyncPath(path, cb){
  if(!window.FBDB){ cb(null); return; }
  FBDB.ref(path).once('value', snap => {
    try {
      const raw = snap.val();
      cb(raw ? JSON.parse(raw) : null);
    } catch(e){ cb(null); }
  }, () => cb(null));
}

/* Write a value to an absolute path */
function fbWritePath(path, val){
  if(!window.FBDB) return;
  FBDB.ref(path).set(JSON.stringify(val))
    .catch(e => console.warn('[Firebase] write error on path:', path, e.message));
}

/* Real-time listener on an absolute path; cb(parsedArray) */
function fbListenPath(path, cb){
  if(!window.FBDB) return;
  FBDB.ref(path).on('value', snap => {
    try {
      const raw = snap.val();
      if(raw){
        const arr = JSON.parse(raw);
        if(Array.isArray(arr) && arr.length) cb(arr);
      }
    } catch(e){}
  });
}

/* ════════════════════════════════════════════════════════
   ADMIN DB — push / load the user database uploaded via admin panel
   Stored at Firebase root: _db/mentors & _db/students
   ════════════════════════════════════════════════════════ */

/* Load admin DB from Firebase → cache in localStorage → cb({mentors, students} | null) */
function fbLoadDB(cb){
  if(!window.FBDB){ cb(null); return; }
  FBDB.ref('_db').once('value', snap => {
    try {
      const val = snap.val();
      if(!val){ cb(null); return; }
      const mentors  = JSON.parse(val.mentors  || '[]');
      const students = JSON.parse(val.students || '[]');
      if(mentors.length || students.length){
        localStorage.setItem('_dyn_mentors',  val.mentors);
        localStorage.setItem('_dyn_students', val.students);
        console.log(`%c[Firebase] 📦 DB טעון: ${mentors.length} חונכים, ${students.length} סטודנטים`, 'color:#16a34a');
        cb({ mentors, students });
      } else {
        cb(null);
      }
    } catch(e){ console.warn('[Firebase] fbLoadDB parse error', e); cb(null); }
  }, () => cb(null));
}

/* ════════════════════════════════════════════════════════
   FIREBASE AUTH — sign-in / sign-out helpers
   ════════════════════════════════════════════════════════ */

/*
  fbSignIn(email, password, cb)
  ─────────────────────────────
  Tries to sign the user into Firebase Auth.
  On first-ever login the account won't exist yet → we create it automatically.
  cb(true)  — auth succeeded (or gracefully skipped)
  cb(false) — hard failure (shouldn't happen; kept for safety)
*/
function fbSignIn(email, password, cb){
  if(!firebase.auth){
    console.warn('[Auth] firebase.auth not available — skipping sign-in');
    cb(true); return;
  }
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(() => {
      console.log('%c[Auth] ✅ Firebase sign-in OK:', 'color:#16a34a;font-weight:bold', email);
      cb(true);
    })
    .catch(err => {
      if(err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email'){
        /* First-time user — create the Firebase Auth account silently */
        firebase.auth().createUserWithEmailAndPassword(email, password)
          .then(() => {
            console.log('%c[Auth] 🆕 Firebase account created:', 'color:#0284c7;font-weight:bold', email);
            cb(true);
          })
          .catch(e2 => {
            /* createUser can fail (e.g. weak password) — log but don't block login */
            console.warn('[Auth] createUser failed (non-blocking):', e2.message);
            cb(true);
          });
      } else {
        /* Wrong password or other error — still non-blocking for app login */
        console.warn('[Auth] signIn error (non-blocking):', err.message);
        cb(true);
      }
    });
}

/*
  fbSignOut(cb)
  ─────────────
  Signs the current Firebase Auth user out, then calls cb().
*/
function fbSignOut(cb){
  if(!firebase.auth){ if(cb) cb(); return; }
  firebase.auth().signOut()
    .then(() => { console.log('[Auth] signed out'); if(cb) cb(); })
    .catch(() => { if(cb) cb(); });
}

/* Push admin DB to Firebase in two writes — cb(true | false) */
function fbPushAdminDB(mentors, students, cb){
  if(!window.FBDB){ cb(false, 'Firebase לא מחובר'); return; }
  FBDB.ref('_db').set({
    mentors:   JSON.stringify(mentors),
    students:  JSON.stringify(students),
    updatedAt: Date.now()
  }).then(() => {
    console.log(`%c[Firebase] ✅ Admin DB נדחף: ${mentors.length} חונכים, ${students.length} סטודנטים`, 'color:#16a34a;font-weight:bold');
    cb(true);
  }).catch(e => {
    console.error('[Firebase] fbPushAdminDB error:', e.message);
    cb(false, e.message);
  });
}
