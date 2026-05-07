'use strict';

/* ══ PROGRAM → MENTOR mapping ══ */
const PROG_MENTOR = {
  'הנדסת תעשייה וניהול':  'hadar.itzhaki@afeka.ac.il',
  'הנדסת חשמל':            'daniel.cohen@afeka.ac.il',
  'הנדסת תוכנה':           'noa.levi@afeka.ac.il',
  'מדעי הנתונים':          'yoav.mizrahi@afeka.ac.il',
  'הנדסה מכנית':           'maya.peretz@afeka.ac.il',
  'הנדסה רפואית':          'itai.barak@afeka.ac.il',
  'הנדסת מערכות מידע':    'shir.alon@afeka.ac.il',
  'מדעי המחשב':            'royi.gold@afeka.ac.il',
};

/* ══ AUTH ══ */
function getUser(){return JSON.parse(localStorage.getItem('currentUser')||'null');}
function requireAuth(){const u=getUser();if(!u){window.location.href='login.html';return null;}return u;}
function logout(){localStorage.removeItem('currentUser');window.location.href='login.html';}

function requireMentor(){
  const u=requireAuth();
  if(u&&!u.isMentor){window.location.href='student.html';return null;}
  return u;
}
function requireStudent(){
  const u=requireAuth();
  if(u&&u.isMentor){window.location.href='dashboard.html';return null;}
  return u;
}

/* returns mentor email to use as data namespace */
function getMentorEmail(){
  const u=getUser();
  if(!u)return null;
  if(u.isMentor)return u.e;
  return PROG_MENTOR[u.prog]||null;
}
function getMentorObj(){
  const email=getMentorEmail();
  return email?DB_MENTORS.find(m=>m.e===email):null;
}
function getMentorStudentCount(){
  const u=getUser();
  if(!u||!u.isMentor)return 0;
  return DB_STUDENTS.filter(s=>s.prog===u.prog).length;
}

function populateHeader(){
  const u=getUser();
  if(!u)return;
  const nameEl  =document.getElementById('sh-name');
  const roleEl  =document.getElementById('sh-role');
  const avatarEl=document.getElementById('sh-avatar');
  if(nameEl)nameEl.textContent=u.n;
  if(roleEl){
    roleEl.textContent=u.isMentor?`${u.role} · שנה ${u.yr}`:`${u.prog} · שנה ${u.yr}`;
  }
  if(avatarEl){
    avatarEl.textContent=u.n.split(' ').slice(0,2).map(w=>w[0]).join('');
  }
  const path=location.pathname.split('/').pop();
  document.querySelectorAll('.sh-nav a').forEach(a=>{
    if(a.getAttribute('href')===path)a.classList.add('active');
  });
}

/* ══ DATA (per-mentor namespace) ══ */
const FAQ_DEFAULTS=[
  {id:1,q:'איפה נמצא משרד האגודה?',a:'משרד האגודה נמצא בבניין א, חדר 105. שעות הפעילות הן שני-חמישי, 9:00-16:00.'},
  {id:2,q:'איך נרשמים לקורסים?',a:'הרשמה לקורסים מתבצעת דרך פורטל הסטודנטים בתקופת ההרשמה. בדקו את הדוא"ל לתאריכים.'},
  {id:3,q:'מה שעות הפתיחה של הספרייה?',a:'הספרייה פתוחה ראשון-חמישי: 8:00-22:00, שישי: 8:00-14:00. סגורה בשבת וחגים.'},
  {id:4,q:'איך מגישים בקשה למלגה?',a:'בקשות למלגות זמינות בפורטל הסטודנטים. המועד האחרון הוא בסוף כל סמסטר.'},
  {id:5,q:'מה שעות הפתיחה של משרדי הממונה?',a:'משרדי הממונה פתוחים ראשון-חמישי, 10:00-14:00. ניתן לקבוע תור מראש בפורטל.'},
];

function _getAnnDefaults(){
  const u=getUser();
  if(!u)return[];
  // Generate defaults based on the mentor's program (works for both mentor and student)
  const prog=u.prog;
  const students=DB_STUDENTS.filter(s=>s.prog===prog).slice(0,3);
  const titles=['עדכון לקראת הסמסטר','הגשות השבוע — חשוב!','כל הכבוד על ההתקדמות 💪'];
  const bodies=[
    'שלום, רציתי לוודא שאתה/את מסתדר/ת עם החומר לקראת הסמסטר. אשמח לדבר בכל שאלה.',
    'יש מועדי הגשה קרובים השבוע — אנא בדוק/י את לוח הזמנים בפורטל הסטודנטים.',
    'ראיתי את ציוני הביניים שלך ורציתי לעודד. אתה/את בדרך הנכונה! המשך/י כך!',
  ];
  const dates=['5 דצמבר 2025','4 דצמבר 2025','3 דצמבר 2025'];
  const result=students.map((s,i)=>({
    id:i+1,studentId:s.id,studentName:s.n,
    title:titles[i]||titles[0],
    body:bodies[i]||bodies[0],date:dates[i]||dates[0],
    views:0,viewedBy:[],
  }));
  // If the current user is a student not covered by the first 3 defaults, add one for them
  if(!u.isMentor && !result.find(a=>a.studentId===u.id)){
    result.push({
      id:result.length+1,studentId:u.id,studentName:u.n,
      title:'ברוכ/ה הבאה לסמסטר החדש',
      body:'שלום! אשמח לעזור בכל שאלה ולתמוך לאורך הדרך 😊',
      date:'1 דצמבר 2025',views:0,viewedBy:[],
    });
  }
  return result;
}

function _storageKey(key){
  const email=getMentorEmail();
  return email?`mty_${key}_${email}`:`mty_${key}`;
}
const CHATS_V=4; // bump to force-rebuild stale cached chats

function getData(key){
  try{
    const raw=localStorage.getItem(_storageKey(key));
    if(raw){
      const d=JSON.parse(raw);
      if(d&&d.length){
        // Force-rebuild chats when version changed
        if(key==='chats'&&d[0]._v!==CHATS_V)throw new Error('stale');
        return d;
      }
    }
  }catch(e){}
  if(key==='chats')return buildChats();
  if(key==='anns')return _getAnnDefaults();
  if(key==='faqs')return JSON.parse(JSON.stringify(FAQ_DEFAULTS));
  return[];
}
function setData(key,val){localStorage.setItem(_storageKey(key),JSON.stringify(val));}

/* ══ CHATS builder ══ */
const CHAT_PREVIEWS=[
  'שלום! יש לי שאלה לגבי הגשת העבודה',
  'תודה על ההסבר האחרון!',
  'מתי שעות הקבלה שלך?',
  'לא הצלחתי להירשם לקורס',
  'מה הדדליין לפרויקט הסמסטריאלי?',
  'איך מבקשים דחייה בהגשה?',
  'האם צריך להגיש את הדוח השבוע?',
  'יש לי קושי עם חומר השיעור האחרון',
];
// hoursAgo per student — several >336h (2+ weeks) show in red on dashboard
const CHAT_GAPS=[
  504, 2, 336, 1, 720,   // first 5 on dashboard: 3 weeks, now, 2 weeks, now, 4 weeks → 3 red
  5, 48, 0, 168, 12,
  3, 336, 14, 504, 25,
  120, 7, 240, 30, 54,
];

function buildChats(){
  const u=getUser();
  if(!u)return[];
  if(u.isMentor){
    const myStudents=DB_STUDENTS.filter(s=>s.prog===u.prog).slice(0,20);
    return myStudents.map((s,i)=>{
      const prev=CHAT_PREVIEWS[i%CHAT_PREVIEWS.length];
      return{_v:CHATS_V,id:s.id,name:s.n,initials:s.ini,color:s.color,
        online:i%5===0,hoursAgo:CHAT_GAPS[i]||0,preview:prev,
        prog:s.prog,yr:s.yr,lang:s.lang,ld:s.ld,
        msgs:[{t:prev,sent:false,time:'10:30'}]};
    });
  }else{
    const mentor=getMentorObj();
    if(!mentor)return[];
    const ini=mentor.n.split(' ').map(w=>w[0]).join('');
    return[{_v:CHATS_V,id:9999,name:mentor.n,initials:ini,color:'#3EA9A3',
      online:true,hoursAgo:0,preview:'שלום! אני חונך/ת שלך לסמסטר זה.',
      prog:mentor.prog,yr:mentor.yr,isMentorChat:true,
      msgs:[{t:'שלום! אני חונך/ת שלך לסמסטר זה. אשמח לעזור בכל שאלה 😊',sent:false,time:'09:00'}]}];
  }
}

/* ══ HELPERS ══ */
function x(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function fmtTime(h){
  if(h<1)return'לפני דקות';
  if(h<24)return`לפני ${h} שעות`;
  const d=Math.round(h/24);
  if(d===1)return'לפני יום';
  if(d<7)return`לפני ${d} ימים`;
  return`לפני ${Math.round(d/7)} שבועות`;
}

let _tt;
function toast(msg,type){
  let el=document.getElementById('toast');
  if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);}
  el.textContent=msg;
  el.className='toast show'+(type?' '+type:'');
  clearTimeout(_tt);
  _tt=setTimeout(()=>el.classList.remove('show'),3000);
}
function openModal(id){document.getElementById(id).classList.remove('hidden');}
function closeModal(id){document.getElementById(id).classList.add('hidden');}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.overlay').forEach(o=>{
    o.addEventListener('click',e=>{if(e.target===o)closeModal(o.id);});
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')document.querySelectorAll('.overlay:not(.hidden)').forEach(o=>closeModal(o.id));
  });
});
