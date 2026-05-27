'use strict';

/* Program→mentor mapping intentionally empty — assignments come from Firebase via admin panel */
const PROG_MENTOR = {};

/* ══ AUTH ══ */
function getUser(){return JSON.parse(localStorage.getItem('currentUser')||'null');}
function requireAuth(){const u=getUser();if(!u){window.location.href='login.html';return null;}return u;}
function logout(){
  localStorage.removeItem('currentUser');
  if(typeof fbSignOut==='function') fbSignOut(()=>{ window.location.href='login.html'; });
  else window.location.href='login.html';
}

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

/* Returns the PRIMARY mentor email (used as Firebase namespace) */
function getMentorEmail(){
  const u=getUser();
  if(!u)return null;
  if(u.isMentor)return u.e;
  /* Dynamic assignment: student.mentors[0] is the primary (faculty) mentor */
  if(u.mentors&&u.mentors.length)return u.mentors[0];
  return PROG_MENTOR[u.prog]||null;
}
/* Returns ALL mentor emails assigned to this student */
function getMentorEmails(){
  const u=getUser();
  if(!u)return[];
  if(u.isMentor)return[u.e];
  if(u.mentors&&u.mentors.length)return u.mentors;
  const single=PROG_MENTOR[u.prog];
  return single?[single]:[];
}
function getMentorObj(){
  const email=getMentorEmail();
  return email?(getMentorsDB().find(m=>m.e===email)||null):null;
}
function getMentorStudentCount(){
  const u=getUser();
  if(!u||!u.isMentor)return 0;
  /* Prefer the explicit students list set by the admin panel matching */
  if(u.students&&u.students.length) return u.students.length;
  /* Fallback: count by program from the dynamic DB */
  return getStudentsDB().filter(s=>s.prog===u.prog).length;
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
  {id:6,q:'מה משך כל שיעור בפועל ואיך מתנהלות ההפסקות?',a:'השיעורים במערכת כתובים כשעות עגולות (למשל 8:00–9:00) אך בפועל כל שיעור נמשך 50 דקות ואחריו 10 דקות הפסקה. אין הפסקה מיוחדת לארוחת צהריים — יש לנצל את 10 דקות ההפסקה או שעות חלון. בשיעורים של יותר משעה ברצף, ניתן לנסות לסכם עם המרצה שירצה רצוף ויעשה הפסקה ארוכה יותר בשעת הצהריים.'},
  {id:7,q:'מה עושים בדקאנט הסטודנטים ומי אחראי על מה?',a:'בדקאנט הסטודנטים מטופלים כל מקרי הפרט: מילואים — סיוון, לינדה ודניאל; התאמות בבחינות, אבחונים ונגישות — אנה, שירלי וספיר. שימו לב: אבחונים ישנים מתקבלים למכינה בלבד — לתואר נדרש אבחון עדכני. מגבלת נגישות? פנו לדקאנט לפני תחילת הלימודים. חונכויות ושיעורי עזר בתשלום סמלי — רשימה במודל תחת קורס הדקאנט (מודל ← כלים לסטודנט ← דקאנט). אוכלוסיות מיוחדות (חברה ערבית, עולים) מטופלות גם הן בדקאנט, ולחברה הערבית קיימת קבוצה עם חונכת דוברת ערבית.'},
  {id:8,q:'מה מציעה יחידת אופק לסטודנטים?',a:'מרכז החדשנות והיזמות — סדנאות, האקתונים ושעות ייעוץ. מעורבות חברתית — "רובוט בא לכיתה", פרויקטים עם משרד המדע, קרן רוטרי, אייסף ואימפקט. מרכז לקידום למידה — ניהול זמן, מתמטיקה, פיזיקה, אנגלית (כולל שיפור מבטא) והכנה לעולם העסקי. מועדוני סטודנטים — רובוטיקה, רכב, מהנדסים ללא גבולות, Pro-Woman ועוד. נבחרות ספורט ותוכניות חילופי סטודנטים בחו"ל. ביום רביעי בזמן אפקה (13:00 ללימודי יום, 18:40–19:10 ללימודי ערב) מתקיים יריד אופק.'},
  {id:9,q:'מה תפקיד ההכוון האקדמי ואיך הוא יכול לעזור?',a:'ההכוון האקדמי מטפל בכל הנושאים המנהלתיים: רישום לקורסים, ציונים וערעורים, אישורי לימודים, ריכוזי ציונים, רישום מחודש לקורס, הקפאה/חידוש לימודים. בנוסף, מסייע בבניית מערכת השעות לאורך התואר וייעוץ כיצד כדאי לסדר את הלימודים.'},
  {id:10,q:'איפה אפשר לאכול ולשתות במכללה?',a:'קפיטריות במתחם הפיקוס ובבניין הקריה. מכונות שתיה ממותקת, שתיה חמה וחטיפים בבניין המפ"ט ובמתחם עתידים. בכל מבנה לשירות הסטודנטים יש מקררים לקופסאות אוכל ומיקרוגלים לחימום. מפוזרים קולרים וברי מים (חמים וקרים) בכל הקמפוס — מומלץ להצטייד בבקבוק/כוס אישיים.'},
  {id:11,q:'איפה קונים ציוד משרדי במכללה?',a:'במתחם הפיקוס, צמוד לקפיטריה, ישנה חנות כלי כתיבה וציוד משרדי המופעלת על ידי אגודת הסטודנטים. המחירים מותאמים לסטודנטים — כמעט במחירי עלות.'},
  {id:12,q:'מה זה "זמני אפקה" ומתי הם מתקיימים?',a:'בכל יום רביעי בשעה 13:00 יש שעת חלון משותפת לכלל הסטודנטים — "זמני אפקה". שעה זו משמשת למכללה ולאגודת הסטודנטים לפעילויות העשרה, הרצאות שאינן קשורות ללימודים, אירועים מיוחדים, ובילוי. כדאי לעקוב אחר הפרסומים של המכללה ושל האגודה.'},
];

function _getAnnDefaults(){
  return[
    {id:1,title:'מועדי בחינות אמצע פורסמו',body:'לוח מועדי הבחינות האמצע לכל הקורסים פורסם. אנא בדקו בפורטל הסטודנטים את מועדי הבחינות והמיקומים הספציפיים שלכם.',date:'5 דצמבר 2025',views:0,viewedBy:[]},
    {id:2,title:'מפגשי למידה קבוצתיים השבוע',body:'הצטרפו אלינו למפגשי למידה משותפים בספרייה כל ערב בין השעות 18:00-20:00. כל הסטודנטים מוזמנים!',date:'4 דצמבר 2025',views:0,viewedBy:[]},
    {id:3,title:'סדנת קריירה: בניית קורות חיים',body:'למדו כיצד ליצור קורות חיים מרשימים. הסדנה מתוכננת ליום שני הבא בשעה 15:00 בחדר 204.',date:'3 דצמבר 2025',views:0,viewedBy:[]},
    {id:4,title:'תזכורת: שעות קבלה שבועיות',body:'שעות הקבלה שלי הן בכל יום שלישי בין 14:00-16:00. ניתן לקבוע תור מראש. אשמח לראות אתכם!',date:'2 דצמבר 2025',views:0,viewedBy:[]},
    {id:5,title:'ברוכים הבאים לסמסטר! 🎉',body:'שלום לכולם! אנחנו שמחים לקבל אתכם לסמסטר החדש. אנא קראו את כל המידע החשוב בלוח הבקרה ואל תהססו לפנות אלינו בכל שאלה.',date:'1 דצמבר 2025',views:0,viewedBy:[]},
  ];
}

function _storageKey(key){
  const email=getMentorEmail();
  return email?`mty_${key}_${email}`:`mty_${key}`;
}
const CHATS_V=7; // bump to force-rebuild stale cached chats
const ANNS_V=3;  // bump when ann data model changes
const FAQS_V=2;  // bump when FAQ_DEFAULTS list grows

function getData(key){
  try{
    const raw=localStorage.getItem(_storageKey(key));
    if(raw){
      const d=JSON.parse(raw);
      if(d&&d.length){
        if(key==='chats'&&d[0]._v!==CHATS_V)throw new Error('stale');
        if(key==='anns'&&(d[0]._v||0)<ANNS_V)throw new Error('stale');
        if(key==='faqs'&&(d[0]._v||0)<FAQS_V)throw new Error('stale');
        return d;
      }
    }
  }catch(e){}
  if(key==='chats')return buildChats();
  if(key==='anns'){const a=_getAnnDefaults();a.forEach(i=>{i._v=ANNS_V;});return a;}
  if(key==='faqs'){const f=JSON.parse(JSON.stringify(FAQ_DEFAULTS));f.forEach(i=>{i._v=FAQS_V;});return f;}
  return[];
}
function setData(key,val){
  const raw=JSON.stringify(val);
  localStorage.setItem(_storageKey(key),raw);
  /* Mirror to Firebase Realtime DB when available */
  if(typeof fbWrite==='function') fbWrite(key,val);
}

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
  if(!u||!u.isMentor)return[]; // students never build chats — they read mentor's list
  const allStudents=getStudentsDB();
  /* If admin panel assigned students explicitly, use that list; else fall back to program */
  let myStudents;
  if(u.students&&u.students.length){
    myStudents=allStudents.filter(s=>u.students.includes(s.id)||u.students.includes(String(s.id)));
  } else {
    myStudents=allStudents.filter(s=>s.prog===u.prog);
  }
  myStudents=myStudents.slice(0,20);
  return myStudents.map((s,i)=>{
    const ini=s.ini||(s.n.split(' ').slice(0,2).map(w=>w[0]).join(''));
    const color=s.color||_PALETTE[i%_PALETTE.length];
    return{_v:CHATS_V,id:s.id,name:s.n,initials:ini,color,
      online:false,hoursAgo:0,preview:'',
      prog:s.prog,yr:s.yr,lang:s.lang,ld:s.ld,
      msgs:[]};
  });
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
