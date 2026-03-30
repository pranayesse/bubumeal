// ============================================================
//  BUBU'S DIET PLAN — Main Application v3.0
//  Firebase + Vanilla JS · Mobile-first · Smart Recommendations
// ============================================================

// Safe Firebase init
let auth, db, storage;
try {
  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
    firebase.initializeApp(FIREBASE_CONFIG);
    auth    = firebase.auth();
    db      = firebase.firestore();
    storage = firebase.storage();
    // Enable persistence for offline support
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  }
} catch(e) { console.warn('Firebase not configured yet:', e.message); }

const safeDb  = { collection: () => ({ doc: () => ({ get: async ()=>({exists:false,data:()=>({})}), set: async()=>{}, update: async()=>{} }), where: ()=>({ orderBy:()=>({ limit:()=>({ get:async()=>({docs:[]}) }) }), get:async()=>({docs:[]}) }), orderBy:()=>({ limit:()=>({ get:async()=>({docs:[]}) }) }) }) };
if (!db)      db      = safeDb;
if (!storage) storage = { ref: () => ({ put: async()=>{}, getDownloadURL: async()=>'' }) };
if (!auth)    auth    = { onAuthStateChanged: cb => cb(null), signInWithEmailAndPassword: async()=>{}, signOut: async()=>{}, setPersistence: async()=>{} };

// ── STATE ──────────────────────────────────────────────────
const state = {
  user: null, role: null, realName: null, nickname: null,
  todayPlan: null, todayLog: null,
  currentWeight: 65, targetWeight: 55,
  adminData: {},
  activeTapSlot: null,
  pendingSelections: [],
  activeSuppId: null,
  recentlyLogged: [],  // last 10 items logged across days
  historyDays: [],     // past 7 days of logs
};

// ── CONSTANTS ──────────────────────────────────────────────
const MEAL_WINDOWS = {
  morning: { start:6*60+30, end:10*60,    label:'Morning Meal',  time:'7:30 AM – 10:00 AM', emoji:'🌅', kcalLimit:300 },
  coffee:  { start:11*60,   end:12*60,    label:'Coffee Break',  time:'11:00 AM – 12:00 PM',emoji:'☕', kcalLimit:60 },
  lunch:   { start:12*60+30,end:14*60+30, label:'Lunch',         time:'12:30 PM – 2:30 PM', emoji:'🍱', kcalLimit:500 },
  snack:   { start:15*60+30,end:18*60+30, label:'Snack Time',    time:'3:30 PM – 6:30 PM',  emoji:'🍎', kcalLimit:200 },
  dinner:  { start:19*60,   end:22*60,    label:'Dinner',        time:'7:00 PM – 10:00 PM', emoji:'🌙', kcalLimit:400 },
};

const MEAL_IMAGES = {
  morning:'dudu feeding bubu breakfast.png', coffee:'bubu.gif',
  lunch:'bubu-dudu-eating lunch.webp', snack:'bubu.gif',
  dinner:'dudu feeding bubu dinner.png', fast:'bubu eating pani puri.png',
  default:'main animation loading page.gif',
};

const CALORIE_TARGET = 1400;

// ── OFFICE CANTEEN DATABASE ────────────────────────────────
// Nutrition: { kcal, protein(g), carbs(g), fat(g), fiber(g), iron(mg), vitC(mg), b12(mcg) }
const CANTEEN = {
  salads: [
    { id:'cs1', name:'Compressed Melon, Feta, Sunflower Seeds', emoji:'🥗', kcal:180, protein:6, carbs:18, fat:10, fiber:2, iron:1.2, vitC:15, b12:0.3, tags:['veg','light'], cat:'salad' },
    { id:'cs2', name:'Quinoa, Green Onions in Gochujang Dressing', emoji:'🥗', kcal:220, protein:8, carbs:32, fat:7, fiber:4, iron:2.8, vitC:12, b12:0, tags:['veg','iron','protein'], cat:'salad' },
    { id:'cs3', name:'Asparagus, Orange & Greens with Tomato Salsa', emoji:'🥗', kcal:150, protein:4, carbs:20, fat:6, fiber:3, iron:1.5, vitC:35, b12:0, tags:['veg','vitaminc','light'], cat:'salad' },
    { id:'cs4', name:'Balsamic Mushrooms, Grilled Sweet Potato', emoji:'🥗', kcal:210, protein:5, carbs:30, fat:8, fiber:4, iron:1.8, vitC:10, b12:0, tags:['veg','iron'], cat:'salad' },
    { id:'cs5', name:'Chicken, Olives, Asparagus & Beetroot Salad', emoji:'🥗', kcal:280, protein:22, carbs:15, fat:14, fiber:3, iron:3.2, vitC:18, b12:0.4, tags:['protein','iron'], cat:'salad' },
    { id:'cs6', name:'Chicken, Cherry Tomato, Apple Slaw & Walnut', emoji:'🥗', kcal:290, protein:24, carbs:18, fat:14, fiber:3, iron:2.5, vitC:15, b12:0.3, tags:['protein'], cat:'salad' },
    { id:'cs7', name:'Boiled Egg, Olives & Oregano Crouton Salad', emoji:'🥗', kcal:250, protein:12, carbs:20, fat:14, fiber:2, iron:1.8, vitC:8, b12:0.6, tags:['protein','b12'], cat:'salad' },
    { id:'cs8', name:'Soy Poached Eggs, Broccoli, Gochujang', emoji:'🥗', kcal:220, protein:14, carbs:16, fat:12, fiber:3, iron:2.5, vitC:40, b12:0.8, tags:['protein','b12','vitaminc'], cat:'salad' },
    { id:'cs9', name:'Jamaican Beetroot Slaw', emoji:'🥗', kcal:120, protein:2, carbs:18, fat:5, fiber:3, iron:1.2, vitC:8, b12:0, tags:['veg','light'], cat:'salad' },
    { id:'cs10', name:'Kerabu Timun', emoji:'🥗', kcal:100, protein:3, carbs:12, fat:5, fiber:2, iron:0.8, vitC:6, b12:0, tags:['veg','light'], cat:'salad' },
  ],
  sandwiches: [
    { id:'cw1', name:'Grilled Veg, Pesto & Cheddar Brown Bread', emoji:'🥪', kcal:340, protein:12, carbs:38, fat:16, fiber:4, iron:2.0, vitC:10, b12:0.3, tags:['veg'], cat:'sandwich' },
    { id:'cw2', name:'Cottage Cheese & Chipotle Multigrain', emoji:'🥪', kcal:310, protein:14, carbs:35, fat:13, fiber:5, iron:1.5, vitC:8, b12:0.2, tags:['veg','protein'], cat:'sandwich' },
    { id:'cw3', name:'Panini: Roasted Pepper, Cheese, Olive Tapenade', emoji:'🥪', kcal:350, protein:11, carbs:36, fat:18, fiber:3, iron:1.8, vitC:12, b12:0.2, tags:['veg'], cat:'sandwich' },
    { id:'cw4', name:'Gochujang Scrambled Tofu Sourdough', emoji:'🥪', kcal:280, protein:16, carbs:32, fat:10, fiber:4, iron:3.5, vitC:6, b12:0, tags:['veg','iron','protein'], cat:'sandwich' },
    { id:'cw5', name:'Gochujang Chicken Brown Bread', emoji:'🥪', kcal:340, protein:24, carbs:34, fat:12, fiber:4, iron:2.0, vitC:8, b12:0.3, tags:['protein'], cat:'sandwich' },
    { id:'cw6', name:'Masala Omelette & Garlic Aioli Multigrain', emoji:'🥪', kcal:330, protein:16, carbs:34, fat:14, fiber:4, iron:2.2, vitC:6, b12:0.8, tags:['protein','b12'], cat:'sandwich' },
    { id:'cw7', name:'Pesto Chicken, Mozzarella Multigrain Panini', emoji:'🥪', kcal:370, protein:26, carbs:32, fat:16, fiber:3, iron:1.8, vitC:5, b12:0.4, tags:['protein'], cat:'sandwich' },
    { id:'cw8', name:'Chipotle Egg Mash, Peri Peri Sourdough', emoji:'🥪', kcal:320, protein:14, carbs:34, fat:14, fiber:3, iron:2.0, vitC:8, b12:0.7, tags:['protein','b12','tangy'], cat:'sandwich' },
  ],
  mains: [
    { id:'cm1', name:'Caponata Stuffed Cottage Cheese, Cous Cous', emoji:'🍛', kcal:420, protein:16, carbs:48, fat:18, fiber:5, iron:2.5, vitC:12, b12:0.1, tags:['veg'], cat:'main' },
    { id:'cm2', name:'Tofu Bulgogi on Burnt Garlic Quinoa', emoji:'🍛', kcal:380, protein:20, carbs:42, fat:14, fiber:5, iron:4.0, vitC:15, b12:0, tags:['veg','iron','protein'], cat:'main' },
    { id:'cm3', name:'Baked Chicken, Parsley Brown Rice, Bordelaise', emoji:'🍛', kcal:440, protein:32, carbs:40, fat:16, fiber:3, iron:2.8, vitC:8, b12:0.5, tags:['protein'], cat:'main' },
    { id:'cm4', name:'Grilled Chicken on Tamari Quinoa, Teriyaki', emoji:'🍛', kcal:420, protein:34, carbs:38, fat:14, fiber:4, iron:3.0, vitC:10, b12:0.5, tags:['protein'], cat:'main' },
  ],
  bowls_grains: [
    { id:'bg1', name:'Five Spiced Rice', emoji:'🍚', kcal:200, protein:4, carbs:40, fat:3, fiber:1, iron:0.8, vitC:0, b12:0, tags:['veg'], cat:'bowl-grain' },
    { id:'bg2', name:'Cajun Spiced Rice', emoji:'🍚', kcal:210, protein:4, carbs:42, fat:3, fiber:1, iron:0.8, vitC:0, b12:0, tags:['veg'], cat:'bowl-grain' },
    { id:'bg3', name:'Pearl Millet', emoji:'🌾', kcal:180, protein:6, carbs:34, fat:3, fiber:4, iron:3.0, vitC:0, b12:0, tags:['veg','iron','fiber'], cat:'bowl-grain' },
    { id:'bg4', name:'Sambal Mix Grain', emoji:'🍚', kcal:200, protein:5, carbs:38, fat:4, fiber:3, iron:1.5, vitC:0, b12:0, tags:['veg'], cat:'bowl-grain' },
  ],
  bowls_protein: [
    { id:'bp1', name:'Jerk Fried Chicken', emoji:'🍗', kcal:280, protein:24, carbs:12, fat:16, fiber:0, iron:1.8, vitC:4, b12:0.4, tags:['protein'], cat:'bowl-protein' },
    { id:'bp2', name:'Egg Masala Bhurji', emoji:'🥚', kcal:180, protein:12, carbs:6, fat:12, fiber:1, iron:2.0, vitC:5, b12:0.8, tags:['protein','b12','iron'], cat:'bowl-protein' },
    { id:'bp3', name:'Malaysian Chicken Satay', emoji:'🍗', kcal:260, protein:22, carbs:10, fat:15, fiber:1, iron:1.5, vitC:3, b12:0.3, tags:['protein'], cat:'bowl-protein' },
    { id:'bp4', name:'Malaysian Spiced Scrambled Egg', emoji:'🥚', kcal:170, protein:12, carbs:4, fat:12, fiber:0, iron:1.8, vitC:3, b12:0.7, tags:['protein','b12'], cat:'bowl-protein' },
    { id:'bp5', name:'Jamaican Spiced Assorted Beans', emoji:'🫘', kcal:190, protein:10, carbs:28, fat:4, fiber:8, iron:3.5, vitC:6, b12:0, tags:['veg','iron','fiber','protein'], cat:'bowl-protein' },
    { id:'bp6', name:'Soya Chunk', emoji:'🫘', kcal:170, protein:18, carbs:14, fat:5, fiber:3, iron:4.0, vitC:0, b12:0, tags:['veg','iron','protein'], cat:'bowl-protein' },
    { id:'bp7', name:'Wok Tossed Malaysian Rajma', emoji:'🫘', kcal:200, protein:10, carbs:30, fat:5, fiber:7, iron:3.0, vitC:4, b12:0, tags:['veg','iron','fiber'], cat:'bowl-protein' },
    { id:'bp8', name:'Garlic Creamy Green Peas', emoji:'🫛', kcal:160, protein:8, carbs:20, fat:6, fiber:5, iron:2.0, vitC:8, b12:0, tags:['veg','iron','fiber'], cat:'bowl-protein' },
  ],
  bowls_veggies: [
    { id:'bv1', name:'Sauteed Sprouts Mix with Carrot & Capsicum', emoji:'🥦', kcal:90, protein:5, carbs:12, fat:3, fiber:4, iron:1.5, vitC:25, b12:0, tags:['veg','iron','vitaminc','light'], cat:'bowl-veggie' },
    { id:'bv2', name:'Sambal Tossed Vegetables', emoji:'🥦', kcal:80, protein:3, carbs:10, fat:4, fiber:3, iron:1.0, vitC:18, b12:0, tags:['veg','light'], cat:'bowl-veggie' },
  ],
  hearth_chicken: [
    { id:'hc1', name:'Murgh Angara Tikka', emoji:'🍗', kcal:240, protein:28, carbs:6, fat:12, fiber:0, iron:2.0, vitC:5, b12:0.4, tags:['protein','tangy'], cat:'tandoor' },
    { id:'hc2', name:'Baradari Murgh Tangdi Kebab', emoji:'🍗', kcal:260, protein:26, carbs:8, fat:14, fiber:0, iron:2.2, vitC:4, b12:0.4, tags:['protein'], cat:'tandoor' },
    { id:'hc3', name:'Kasundi Murgh Tikka', emoji:'🍗', kcal:250, protein:28, carbs:6, fat:12, fiber:0, iron:2.0, vitC:6, b12:0.4, tags:['protein','tangy'], cat:'tandoor' },
  ],
  hearth_veg: [
    { id:'hv1', name:'Angara Soya Chaap', emoji:'🌿', kcal:200, protein:16, carbs:12, fat:10, fiber:2, iron:3.5, vitC:4, b12:0, tags:['veg','iron','protein'], cat:'tandoor' },
    { id:'hv2', name:'Dahi Ke Kabab', emoji:'🌿', kcal:180, protein:8, carbs:16, fat:10, fiber:1, iron:0.8, vitC:2, b12:0.1, tags:['veg'], cat:'tandoor' },
    { id:'hv3', name:'Paneer Lahori Tikka', emoji:'🧀', kcal:260, protein:14, carbs:10, fat:18, fiber:1, iron:1.0, vitC:5, b12:0.2, tags:['veg','protein'], cat:'tandoor' },
    { id:'hv4', name:'Hare Mutter Ki Shami', emoji:'🌿', kcal:170, protein:8, carbs:18, fat:8, fiber:4, iron:2.0, vitC:6, b12:0, tags:['veg','iron','fiber'], cat:'tandoor' },
  ],
  hearth_curries: [
    { id:'hcu1', name:'Dal Makhani', emoji:'🍛', kcal:250, protein:10, carbs:28, fat:12, fiber:5, iron:3.5, vitC:4, b12:0, tags:['veg','iron','fiber'], cat:'curry' },
    { id:'hcu2', name:'Dal Fry', emoji:'🍛', kcal:180, protein:10, carbs:24, fat:6, fiber:5, iron:3.0, vitC:5, b12:0, tags:['veg','iron','fiber','light'], cat:'curry' },
    { id:'hcu3', name:'Rajma Raseela', emoji:'🍛', kcal:220, protein:10, carbs:32, fat:6, fiber:8, iron:3.5, vitC:6, b12:0, tags:['veg','iron','fiber'], cat:'curry' },
    { id:'hcu4', name:'Home Style Chole Masala', emoji:'🍛', kcal:230, protein:10, carbs:30, fat:8, fiber:7, iron:3.0, vitC:5, b12:0, tags:['veg','iron','fiber'], cat:'curry' },
  ],
  hearth_bread: [
    { id:'hb1', name:'Whole Wheat Tandoori Roti', emoji:'🫓', kcal:80, protein:3, carbs:16, fat:1, fiber:2, iron:1.0, vitC:0, b12:0, tags:['veg','fiber'], cat:'bread' },
    { id:'hb2', name:'Butter Naan', emoji:'🫓', kcal:260, protein:7, carbs:40, fat:8, fiber:1, iron:1.5, vitC:0, b12:0, tags:['veg'], cat:'bread' },
  ],
  south_indian: [
    { id:'si1', name:'Plain Dosa', emoji:'🫓', kcal:120, protein:3, carbs:22, fat:3, fiber:1, iron:0.8, vitC:0, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si2', name:'Masala Dosa', emoji:'🫓', kcal:220, protein:5, carbs:32, fat:8, fiber:2, iron:1.5, vitC:6, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si3', name:'Set Dosa (2)', emoji:'🫓', kcal:180, protein:4, carbs:30, fat:5, fiber:1, iron:1.0, vitC:0, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si4', name:'Ghee Roast Dosa', emoji:'🫓', kcal:250, protein:4, carbs:28, fat:14, fiber:1, iron:1.0, vitC:0, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si5', name:'Onion Dosa', emoji:'🫓', kcal:160, protein:4, carbs:25, fat:5, fiber:2, iron:1.0, vitC:3, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si6', name:'Plain Idly (2)', emoji:'🫙', kcal:100, protein:4, carbs:20, fat:0.5, fiber:1, iron:0.6, vitC:0, b12:0, tags:['veg','south-indian','light'], cat:'south-indian' },
    { id:'si7', name:'Idly Vada', emoji:'🫙', kcal:220, protein:8, carbs:28, fat:8, fiber:2, iron:1.5, vitC:0, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si8', name:'Medu Vada (1)', emoji:'🫙', kcal:130, protein:5, carbs:14, fat:7, fiber:2, iron:1.2, vitC:0, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si9', name:'Plain Uttapam', emoji:'🫓', kcal:180, protein:5, carbs:28, fat:5, fiber:2, iron:1.0, vitC:0, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si10', name:'Onion Uttapam', emoji:'🫓', kcal:200, protein:5, carbs:30, fat:6, fiber:2, iron:1.2, vitC:3, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si11', name:'Masala Uttapam', emoji:'🫓', kcal:220, protein:6, carbs:32, fat:7, fiber:3, iron:1.5, vitC:5, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si12', name:'Sambar + Rice', emoji:'🍲', kcal:280, protein:9, carbs:48, fat:6, fiber:5, iron:3.5, vitC:8, b12:0, tags:['veg','south-indian','iron','fiber'], cat:'south-indian' },
    { id:'si13', name:'Coconut Chutney + Idly', emoji:'🥥', kcal:160, protein:5, carbs:24, fat:6, fiber:2, iron:0.8, vitC:2, b12:0, tags:['veg','south-indian','light'], cat:'south-indian' },
    { id:'si14', name:'Veg Kurma + Parotta', emoji:'🥘', kcal:380, protein:8, carbs:52, fat:16, fiber:4, iron:2.0, vitC:10, b12:0, tags:['veg','south-indian'], cat:'south-indian' },
    { id:'si15', name:'Tomato Rasam + Rice', emoji:'🍅', kcal:240, protein:5, carbs:42, fat:6, fiber:3, iron:2.0, vitC:18, b12:0, tags:['veg','south-indian','tangy','vitaminc'], cat:'south-indian' },
    { id:'si16', name:'Curd Rice + Pickle', emoji:'🫙', kcal:260, protein:7, carbs:40, fat:8, fiber:1, iron:0.5, vitC:3, b12:0.2, tags:['veg','south-indian','light'], cat:'south-indian' },
    { id:'si17', name:'Bisi Bele Bath', emoji:'🍲', kcal:320, protein:10, carbs:48, fat:10, fiber:6, iron:3.0, vitC:8, b12:0, tags:['veg','south-indian','iron','fiber'], cat:'south-indian' },
    { id:'si18', name:'Avial + Rice', emoji:'🥦', kcal:290, protein:6, carbs:44, fat:10, fiber:5, iron:2.5, vitC:20, b12:0, tags:['veg','south-indian','vitaminc'], cat:'south-indian' },
    { id:'si19', name:'Pongal', emoji:'🍚', kcal:250, protein:7, carbs:40, fat:8, fiber:2, iron:1.5, vitC:0, b12:0, tags:['veg','south-indian','light'], cat:'south-indian' },
    { id:'si20', name:'Keerai Masiyal (Spinach Curry)', emoji:'🌿', kcal:140, protein:5, carbs:12, fat:7, fiber:4, iron:4.0, vitC:25, b12:0, tags:['veg','south-indian','iron','vitaminc'], cat:'south-indian' },
    { id:'tl1', name:'Gongura Mutton + Rice', emoji:'🍖', kcal:450, protein:30, carbs:42, fat:18, fiber:3, iron:4.5, vitC:12, b12:1.5, tags:['iron','tangy','south-indian'], cat:'south-indian', note:'Tangy Telangana classic 🌶️' },
    { id:'tl2', name:'Kodi Pulusu + Rice', emoji:'🍗', kcal:420, protein:28, carbs:44, fat:16, fiber:2, iron:3.0, vitC:8, b12:0.5, tags:['tangy','south-indian','protein'], cat:'south-indian', note:'Telangana chicken curry' },
    { id:'tl3', name:'Chepa Pulusu + Rice', emoji:'🐟', kcal:400, protein:26, carbs:42, fat:14, fiber:2, iron:3.5, vitC:6, b12:3.0, tags:['iron','b12','tangy','south-indian'], cat:'south-indian', note:'Tangy fish curry — iron & B12!' },
    { id:'tl4', name:'Royyala Iguru + Rice', emoji:'🦐', kcal:380, protein:24, carbs:40, fat:14, fiber:1, iron:3.0, vitC:8, b12:2.0, tags:['iron','b12','south-indian'], cat:'south-indian', note:'Prawn dry curry' },
    { id:'tl5', name:'Ulava Charu + Rice', emoji:'🍲', kcal:310, protein:12, carbs:48, fat:8, fiber:8, iron:4.0, vitC:5, b12:0, tags:['veg','iron','fiber','south-indian'], cat:'south-indian', note:'Horse gram rasam — very iron-rich!' },
    { id:'tl6', name:'Mudda Pappu + Neyyi + Rice', emoji:'🫙', kcal:350, protein:14, carbs:52, fat:10, fiber:6, iron:3.5, vitC:3, b12:0, tags:['veg','iron','fiber','south-indian'], cat:'south-indian', note:'Dal + ghee — comfort food ❤️' },
    { id:'tl7', name:'Gutti Vankaya Kura + Rice', emoji:'🍆', kcal:320, protein:6, carbs:46, fat:12, fiber:5, iron:2.0, vitC:6, b12:0, tags:['veg','tangy','south-indian'], cat:'south-indian', note:'Stuffed brinjal curry' },
    { id:'tl8', name:'Dosakaya Pappu + Rice', emoji:'🥒', kcal:300, protein:10, carbs:48, fat:8, fiber:5, iron:3.0, vitC:10, b12:0, tags:['veg','tangy','south-indian'], cat:'south-indian', note:'Yellow cucumber dal — tangy!' },
    { id:'tl9', name:'Tomato Pappu + Rice', emoji:'🍅', kcal:290, protein:10, carbs:46, fat:8, fiber:4, iron:2.5, vitC:18, b12:0, tags:['veg','tangy','south-indian','vitaminc'], cat:'south-indian', note:'Tangy tomato dal' },
    { id:'tl10', name:'Bendakaya Kura + Rice', emoji:'🌿', kcal:280, protein:5, carbs:42, fat:10, fiber:5, iron:1.5, vitC:16, b12:0, tags:['veg','south-indian','fiber'], cat:'south-indian', note:'Okra curry' },
    { id:'tl11', name:'Vankai Kura + Chapati', emoji:'🍆', kcal:300, protein:6, carbs:38, fat:12, fiber:5, iron:1.8, vitC:5, b12:0, tags:['veg','south-indian'], cat:'south-indian', note:'Brinjal curry' },
    { id:'tl12', name:'Aava Pettina Kodi + Rice', emoji:'🍗', kcal:410, protein:26, carbs:42, fat:16, fiber:2, iron:2.5, vitC:5, b12:0.5, tags:['tangy','south-indian','protein'], cat:'south-indian', note:'Mustard chicken — spicy!' },
    { id:'tl13', name:'Pesarattu + Ginger Chutney', emoji:'🫓', kcal:280, protein:14, carbs:36, fat:8, fiber:5, iron:3.5, vitC:8, b12:0, tags:['veg','south-indian','protein','iron'], cat:'south-indian', note:'Green moong crepe — iron rich!' },
    { id:'tl14', name:'Sarva Pindi', emoji:'🫓', kcal:260, protein:8, carbs:34, fat:10, fiber:4, iron:2.5, vitC:4, b12:0, tags:['veg','south-indian'], cat:'south-indian', note:'Rice flour pancake — Telangana special' },
    { id:'tl15', name:'Jonna Roti + Kodi Kura', emoji:'🫓', kcal:380, protein:22, carbs:42, fat:14, fiber:4, iron:3.0, vitC:5, b12:0.3, tags:['south-indian','protein','iron'], cat:'south-indian', note:'Sorghum roti + chicken curry' },
    { id:'tl16', name:'Natu Kodi Pulusu + Rice', emoji:'🍗', kcal:440, protein:30, carbs:44, fat:18, fiber:2, iron:3.5, vitC:6, b12:0.8, tags:['iron','tangy','south-indian','protein'], cat:'south-indian', note:'Country chicken curry 🌶️' },
    { id:'tl17', name:'Mamidikaya Pappu + Rice', emoji:'🥭', kcal:300, protein:10, carbs:48, fat:8, fiber:4, iron:2.5, vitC:20, b12:0, tags:['veg','tangy','south-indian','vitaminc'], cat:'south-indian', note:'Raw mango dal — tangy!' },
    { id:'tl18', name:'Menthi Kura Pappu + Rice', emoji:'🌿', kcal:290, protein:12, carbs:44, fat:8, fiber:6, iron:5.0, vitC:10, b12:0, tags:['veg','iron','fiber','south-indian'], cat:'south-indian', note:'Fenugreek leaves dal — highest iron!' },
    // ── FRY ITEMS ──
    { id:'fr1', name:'Fish Fry', emoji:'🐟', kcal:220, protein:24, carbs:4, fat:12, fiber:0, iron:2.5, vitC:3, b12:2.5, tags:['iron','b12','protein','south-indian'], cat:'south-indian', note:'Crispy spiced fish fry 🌶️' },
    { id:'fr2', name:'Prawn Fry', emoji:'🦐', kcal:200, protein:22, carbs:4, fat:10, fiber:0, iron:2.8, vitC:4, b12:2.0, tags:['iron','b12','protein','south-indian'], cat:'south-indian', note:'Spicy prawn fry' },
    { id:'fr3', name:'Chicken Fry', emoji:'🍗', kcal:280, protein:26, carbs:6, fat:16, fiber:0, iron:1.8, vitC:3, b12:0.4, tags:['protein','south-indian'], cat:'south-indian', note:'Andhra-style spicy chicken fry' },
    { id:'fr4', name:'Aloo Fry', emoji:'🥔', kcal:200, protein:3, carbs:28, fat:9, fiber:3, iron:1.2, vitC:15, b12:0, tags:['veg','south-indian'], cat:'south-indian', note:'Crispy potato fry' },
    { id:'fr5', name:'Bendakaya Fry (Okra)', emoji:'🌿', kcal:160, protein:3, carbs:14, fat:10, fiber:4, iron:1.5, vitC:16, b12:0, tags:['veg','south-indian','fiber'], cat:'south-indian', note:'Crispy okra fry' },
    { id:'fr6', name:'Vankaya Fry (Brinjal)', emoji:'🍆', kcal:170, protein:3, carbs:16, fat:10, fiber:4, iron:1.2, vitC:5, b12:0, tags:['veg','south-indian'], cat:'south-indian', note:'Spiced brinjal fry' },
    { id:'fr7', name:'Egg Fry (2)', emoji:'🥚', kcal:180, protein:12, carbs:2, fat:14, fiber:0, iron:1.8, vitC:0, b12:1.2, tags:['protein','b12','south-indian'], cat:'south-indian', note:'Masala egg fry' },
    { id:'fr8', name:'Cauliflower Fry', emoji:'🥦', kcal:150, protein:4, carbs:12, fat:9, fiber:3, iron:1.0, vitC:48, b12:0, tags:['veg','south-indian','vitaminc'], cat:'south-indian', note:'Gobi fry — high vitamin C!' },
    { id:'fr9', name:'Mushroom Fry', emoji:'🍄', kcal:140, protein:5, carbs:8, fat:9, fiber:2, iron:1.5, vitC:3, b12:0.1, tags:['veg','south-indian'], cat:'south-indian', note:'Spiced mushroom fry' },
    { id:'fr10', name:'Mutton Fry', emoji:'🍖', kcal:300, protein:28, carbs:4, fat:18, fiber:0, iron:4.0, vitC:2, b12:2.0, tags:['iron','b12','protein','south-indian'], cat:'south-indian', note:'Dry mutton fry — iron-rich!' },
    // ── MORE ANDHRA CURRIES ──
    { id:'ap1', name:'Gongura Pachadi + Rice', emoji:'🌿', kcal:280, protein:5, carbs:46, fat:8, fiber:3, iron:3.0, vitC:20, b12:0, tags:['veg','tangy','south-indian','vitaminc'], cat:'south-indian', note:'Sorrel chutney — Andhra must-have!' },
    { id:'ap2', name:'Perugu Pachadi + Rice', emoji:'🥛', kcal:250, protein:7, carbs:40, fat:7, fiber:1, iron:0.5, vitC:3, b12:0.3, tags:['veg','south-indian','light'], cat:'south-indian', note:'Curd chutney — cooling & light' },
    { id:'ap3', name:'Natu Kodi Vepudu + Rice', emoji:'🍗', kcal:420, protein:30, carbs:40, fat:18, fiber:1, iron:3.5, vitC:4, b12:0.8, tags:['iron','south-indian','protein'], cat:'south-indian', note:'Country chicken roast' },
    { id:'ap4', name:'Kobbari Annam (Coconut Rice)', emoji:'🥥', kcal:320, protein:5, carbs:50, fat:12, fiber:2, iron:1.0, vitC:2, b12:0, tags:['veg','south-indian'], cat:'south-indian', note:'Fragrant coconut rice' },
    { id:'ap5', name:'Pulihora (Tamarind Rice)', emoji:'🍚', kcal:330, protein:5, carbs:54, fat:10, fiber:2, iron:2.0, vitC:4, b12:0, tags:['veg','tangy','south-indian'], cat:'south-indian', note:'Tangy tamarind rice — festival fave!' },
    { id:'ap6', name:'Kura Pappu (Mixed Veg Dal)', emoji:'🥘', kcal:300, protein:12, carbs:44, fat:8, fiber:5, iron:3.0, vitC:12, b12:0, tags:['veg','south-indian','iron','fiber'], cat:'south-indian', note:'Comfort dal with veggies' },
    { id:'ap7', name:'Chepala Pulusu + Rice', emoji:'🐟', kcal:390, protein:25, carbs:42, fat:13, fiber:2, iron:3.5, vitC:8, b12:2.5, tags:['iron','b12','tangy','south-indian'], cat:'south-indian', note:'Andhra fish curry — tangy & spicy!' },
    { id:'ap8', name:'Royyala Pulusu + Rice', emoji:'🦐', kcal:370, protein:22, carbs:42, fat:13, fiber:2, iron:3.0, vitC:6, b12:2.0, tags:['iron','b12','tangy','south-indian'], cat:'south-indian', note:'Prawn tamarind curry' },
    { id:'ap9', name:'Kandagadda Vepudu + Rice', emoji:'🥔', kcal:310, protein:5, carbs:48, fat:11, fiber:4, iron:2.0, vitC:15, b12:0, tags:['veg','south-indian'], cat:'south-indian', note:'Yam fry — Andhra style' },
    { id:'ap10', name:'Kakarakaya Fry (Bitter Gourd)', emoji:'🌿', kcal:130, protein:3, carbs:10, fat:8, fiber:3, iron:1.5, vitC:12, b12:0, tags:['veg','south-indian','fiber'], cat:'south-indian', note:'Crispy bitter gourd — healthy!' },
    { id:'ap11', name:'Allam Pachadi + Dosa', emoji:'🫙', kcal:200, protein:4, carbs:30, fat:7, fiber:2, iron:1.0, vitC:3, b12:0, tags:['veg','tangy','south-indian'], cat:'south-indian', note:'Ginger chutney with dosa' },
    { id:'ap12', name:'Nuvvula Karam + Rice', emoji:'🌾', kcal:320, protein:8, carbs:46, fat:12, fiber:3, iron:3.5, vitC:2, b12:0, tags:['veg','south-indian','iron'], cat:'south-indian', note:'Sesame spice powder — iron-rich!' },
  ],
  chaat: [
    { id:'ch1', name:'Sev Puri', emoji:'🌶️', kcal:200, protein:4, carbs:28, fat:8, fiber:2, iron:1.0, vitC:4, b12:0, tags:['veg','tangy'], cat:'chaat' },
    { id:'ch2', name:'Jhalmuri', emoji:'🌶️', kcal:180, protein:4, carbs:26, fat:7, fiber:2, iron:1.2, vitC:5, b12:0, tags:['veg','tangy'], cat:'chaat' },
    { id:'ch3', name:'Bhel Puri', emoji:'🍿', kcal:180, protein:4, carbs:28, fat:6, fiber:2, iron:1.0, vitC:5, b12:0, tags:['veg','tangy'], cat:'chaat', isTreat:true },
    { id:'ch4', name:'Pani Puri (6 pcs)', emoji:'🫙', kcal:200, protein:3, carbs:30, fat:7, fiber:1, iron:0.8, vitC:3, b12:0, tags:['veg','tangy'], cat:'chaat', isTreat:true },
    { id:'ch5', name:'Dahi Puri', emoji:'🌶️', kcal:190, protein:5, carbs:26, fat:7, fiber:1, iron:0.8, vitC:3, b12:0.1, tags:['veg','tangy'], cat:'chaat' },
    { id:'ch6', name:'Churmura Chaat', emoji:'🌶️', kcal:160, protein:4, carbs:24, fat:6, fiber:2, iron:1.0, vitC:4, b12:0, tags:['veg','tangy'], cat:'chaat' },
    { id:'ch7', name:'Chinese Bhel', emoji:'🌶️', kcal:220, protein:4, carbs:30, fat:10, fiber:1, iron:1.0, vitC:4, b12:0, tags:['veg','tangy'], cat:'chaat' },
    { id:'ch8', name:'Dahi Papdi', emoji:'🌶️', kcal:200, protein:5, carbs:28, fat:8, fiber:1, iron:0.8, vitC:3, b12:0.1, tags:['veg','tangy'], cat:'chaat' },
    { id:'ch9', name:'Banarasi Tamatar Ki Chaat', emoji:'🍅', kcal:170, protein:3, carbs:24, fat:7, fiber:2, iron:1.0, vitC:15, b12:0, tags:['veg','tangy','vitaminc'], cat:'chaat' },
    { id:'ch10', name:'Bhalla Papdi Chaat', emoji:'🌶️', kcal:210, protein:6, carbs:28, fat:8, fiber:2, iron:1.2, vitC:4, b12:0, tags:['veg','tangy'], cat:'chaat' },
  ],
  eggs: [
    { id:'eg1', name:'Boiled Egg', emoji:'🥚', kcal:70, protein:6, carbs:0.5, fat:5, fiber:0, iron:0.9, vitC:0, b12:0.6, tags:['protein','b12'], cat:'egg' },
    { id:'eg2', name:'Masala Omelette', emoji:'🥚', kcal:150, protein:10, carbs:2, fat:11, fiber:0, iron:1.5, vitC:3, b12:0.7, tags:['protein','b12'], cat:'egg' },
    { id:'eg3', name:'Scrambled Egg', emoji:'🥚', kcal:130, protein:9, carbs:1, fat:10, fiber:0, iron:1.2, vitC:0, b12:0.6, tags:['protein','b12'], cat:'egg' },
    { id:'eg4', name:'Sunny Side Up', emoji:'🍳', kcal:90, protein:6, carbs:0.5, fat:7, fiber:0, iron:1.0, vitC:0, b12:0.6, tags:['protein','b12'], cat:'egg' },
  ],
  global: [
    { id:'gl1', name:'Veg Burger + Peri Peri Fries', emoji:'🍔', kcal:520, protein:12, carbs:58, fat:26, fiber:4, iron:2.0, vitC:8, b12:0, tags:['veg'], cat:'global' },
    { id:'gl2', name:'Chicken Burger + Peri Peri Fries', emoji:'🍔', kcal:580, protein:24, carbs:55, fat:28, fiber:3, iron:2.5, vitC:8, b12:0.3, tags:['protein'], cat:'global' },
    { id:'gl3', name:'Vegetable Masala Maggi', emoji:'🍜', kcal:300, protein:8, carbs:42, fat:12, fiber:2, iron:1.5, vitC:4, b12:0, tags:['veg'], cat:'global' },
    { id:'gl4', name:'Peri Peri Chicken Maggi', emoji:'🍜', kcal:360, protein:14, carbs:42, fat:16, fiber:2, iron:2.0, vitC:5, b12:0.2, tags:['protein','tangy'], cat:'global' },
  ],
  drinks: [
    { id:'dk1', name:'Coconut Water', emoji:'🥥', kcal:45, protein:1, carbs:10, fat:0, fiber:0, iron:0.3, vitC:3, b12:0, tags:['veg','light'], cat:'drink' },
    { id:'dk2', name:'Buttermilk', emoji:'🥛', kcal:40, protein:3, carbs:5, fat:1, fiber:0, iron:0.1, vitC:1, b12:0.2, tags:['veg','light'], cat:'drink' },
    { id:'dk3', name:'Apple Beetroot Carrot Juice', emoji:'🍹', kcal:120, protein:2, carbs:28, fat:0, fiber:2, iron:1.5, vitC:20, b12:0, tags:['veg','iron','vitaminc'], cat:'drink' },
    { id:'dk4', name:'Cucumber Mint Lemon Juice', emoji:'🍹', kcal:45, protein:1, carbs:10, fat:0, fiber:1, iron:0.5, vitC:15, b12:0, tags:['veg','light','vitaminc'], cat:'drink' },
    { id:'dk5', name:'Orange Juice', emoji:'🍊', kcal:90, protein:1, carbs:22, fat:0, fiber:0, iron:0.3, vitC:50, b12:0, tags:['veg','vitaminc'], cat:'drink' },
    { id:'dk6', name:'Watermelon Juice', emoji:'🍉', kcal:60, protein:1, carbs:14, fat:0, fiber:0, iron:0.3, vitC:8, b12:0, tags:['veg','light'], cat:'drink' },
    { id:'dk7', name:'Amla, Pomegranate & Jaggery Juice', emoji:'🍹', kcal:100, protein:1, carbs:24, fat:0, fiber:1, iron:2.0, vitC:40, b12:0, tags:['veg','iron','vitaminc'], cat:'drink' },
    { id:'dk8', name:'Nimbu Pani', emoji:'🍋', kcal:30, protein:0, carbs:8, fat:0, fiber:0, iron:0.1, vitC:12, b12:0, tags:['veg','light','vitaminc'], cat:'drink' },
    { id:'dk9', name:'Jaljeera', emoji:'🍹', kcal:25, protein:0, carbs:6, fat:0, fiber:0, iron:0.5, vitC:5, b12:0, tags:['veg','light','tangy'], cat:'drink' },
    { id:'dk10', name:'Aam Panna', emoji:'🥭', kcal:70, protein:0, carbs:18, fat:0, fiber:0, iron:0.3, vitC:15, b12:0, tags:['veg','tangy','vitaminc'], cat:'drink' },
    { id:'dk11', name:'Kokum Sharbat', emoji:'🍹', kcal:50, protein:0, carbs:13, fat:0, fiber:0, iron:0.5, vitC:5, b12:0, tags:['veg','tangy','light'], cat:'drink' },
  ],
  fruits: [
    { id:'fr1', name:'Apple', emoji:'🍎', kcal:80, protein:0.5, carbs:20, fat:0, fiber:3, iron:0.2, vitC:7, b12:0, tags:['veg','fiber'], cat:'fruit' },
    { id:'fr2', name:'Banana', emoji:'🍌', kcal:90, protein:1, carbs:22, fat:0, fiber:2, iron:0.3, vitC:9, b12:0, tags:['veg'], cat:'fruit' },
    { id:'fr3', name:'Mixed Fruit Bowl', emoji:'🍇', kcal:120, protein:1, carbs:28, fat:0, fiber:3, iron:0.5, vitC:30, b12:0, tags:['veg','vitaminc','fiber'], cat:'fruit' },
    { id:'fr4', name:'Melon Bowl', emoji:'🍈', kcal:80, protein:1, carbs:18, fat:0, fiber:1, iron:0.3, vitC:15, b12:0, tags:['veg','light','vitaminc'], cat:'fruit' },
  ],
  dessert: [
    { id:'ds1', name:'Granola & Oats Parfait (Sugar Free)', emoji:'🥣', kcal:200, protein:8, carbs:30, fat:6, fiber:4, iron:2.0, vitC:2, b12:0.1, tags:['veg','iron','fiber'], cat:'dessert' },
    { id:'ds2', name:'Greek Yoghurt, Goji Berry & Pumpkin Seeds', emoji:'🥣', kcal:180, protein:10, carbs:20, fat:7, fiber:2, iron:1.5, vitC:5, b12:0.3, tags:['veg','protein'], cat:'dessert' },
    { id:'ds3', name:'Peanut Butter, Dates & Coconut Pudding (SF)', emoji:'🥣', kcal:220, protein:6, carbs:28, fat:10, fiber:3, iron:1.2, vitC:1, b12:0, tags:['veg'], cat:'dessert' },
  ],
  cereals: [
    { id:'ce1', name:'Muesli with Milk', emoji:'🥣', kcal:220, protein:8, carbs:36, fat:6, fiber:4, iron:3.0, vitC:0, b12:0.4, tags:['veg','iron','fiber','b12'], cat:'cereal' },
    { id:'ce2', name:'Corn Flakes with Milk', emoji:'🥣', kcal:180, protein:5, carbs:36, fat:2, fiber:1, iron:4.0, vitC:0, b12:0.3, tags:['veg','iron'], cat:'cereal' },
  ],
  specials: [
    { id:'sp1', name:'Grilled Lamb Chop, Millet Risotto, Espagnole', emoji:'🥩', kcal:520, protein:32, carbs:38, fat:26, fiber:3, iron:4.0, vitC:8, b12:2.5, tags:['protein','iron','b12'], cat:'special' },
    { id:'sp2', name:'Avocado Beetroot Wrap, Walnut Pesto', emoji:'🌯', kcal:380, protein:12, carbs:36, fat:22, fiber:6, iron:2.5, vitC:15, b12:0.2, tags:['veg','iron','fiber'], cat:'special' },
  ],
};

// ── HOME (TELUGU) DINNER OPTIONS ───────────────────────────
const HOME_DINNERS = [
  { id:'hd1', name:'Fish Curry + Rice', emoji:'🐟', kcal:400, protein:28, carbs:40, fat:14, fiber:2, iron:3.5, vitC:8, b12:3.0, tags:['iron','b12','south-indian'], note:'Best iron & B12 dinner! ⭐' },
  { id:'hd2', name:'Prawn Masala + Chapati', emoji:'🦐', kcal:380, protein:26, carbs:32, fat:16, fiber:2, iron:3.0, vitC:10, b12:2.5, tags:['iron','b12','tangy'], note:'Tangy prawn curry 🌶️' },
  { id:'hd3', name:'Gongura Dal + Rice', emoji:'🍅', kcal:320, protein:12, carbs:48, fat:8, fiber:6, iron:4.0, vitC:15, b12:0, tags:['iron','tangy','south-indian'], note:'Her favourite! Tangy & iron-rich ❤️' },
  { id:'hd4', name:'Rasam + Rice + Papad', emoji:'🍲', kcal:290, protein:6, carbs:50, fat:6, fiber:3, iron:2.0, vitC:12, b12:0, tags:['south-indian','tangy','light'], note:'Light & tangy — great digestion' },
  { id:'hd5', name:'Sambar Rice + Pickle', emoji:'🫙', kcal:360, protein:10, carbs:52, fat:12, fiber:5, iron:3.0, vitC:8, b12:0, tags:['south-indian','iron'], note:'Comfort meal with iron' },
  { id:'hd6', name:'Egg Curry + 1 Chapati', emoji:'🥚', kcal:330, protein:16, carbs:28, fat:18, fiber:2, iron:2.5, vitC:6, b12:1.2, tags:['b12','protein','iron'], note:'B12 + Iron + Protein! 💪' },
  { id:'hd7', name:'Tamarind Rice + Raita', emoji:'🍚', kcal:350, protein:6, carbs:56, fat:10, fiber:2, iron:1.5, vitC:5, b12:0, tags:['tangy','south-indian'], note:'Pulihora — she loves tangy! 💕' },
  { id:'hd8', name:'Grilled Fish + Salad', emoji:'🐟', kcal:260, protein:30, carbs:8, fat:12, fiber:2, iron:2.5, vitC:15, b12:2.0, tags:['iron','b12','light'], note:'Lightest & healthiest' },
  { id:'hd9', name:'Tomato Curry + Rice', emoji:'🍅', kcal:300, protein:5, carbs:48, fat:10, fiber:3, iron:2.0, vitC:18, b12:0, tags:['tangy','south-indian','vitaminc'], note:'Tangy tomato — her fave! 🌶️' },
  { id:'hd10', name:'Chicken Curry + 1 Chapati', emoji:'🍗', kcal:400, protein:28, carbs:30, fat:18, fiber:2, iron:2.5, vitC:5, b12:0.5, tags:['protein'], note:'Protein-rich dinner' },
  { id:'hd11', name:'Pesarattu + Ginger Chutney', emoji:'🫓', kcal:280, protein:14, carbs:36, fat:8, fiber:5, iron:3.5, vitC:8, b12:0, tags:['south-indian','protein','iron'], note:'Green moong — iron rich!' },
  { id:'hd12', name:'Light Vegetable Soup', emoji:'🥣', kcal:150, protein:4, carbs:18, fat:6, fiber:4, iron:1.5, vitC:15, b12:0, tags:['light','veg'], note:'Very light — if not hungry' },
  { id:'hd13', name:'Gongura Chicken + Rice', emoji:'🌿', kcal:420, protein:26, carbs:42, fat:16, fiber:3, iron:3.5, vitC:12, b12:0.5, tags:['iron','tangy','south-indian'], note:'Gongura chicken — tangy spicy! 🌶️' },
  { id:'hd14', name:'Prawn Fry + Rasam Rice', emoji:'🦐', kcal:400, protein:24, carbs:46, fat:14, fiber:2, iron:3.0, vitC:10, b12:2.0, tags:['iron','b12','tangy','south-indian'], note:'Seafood combo! ⭐' },
];

// ── TELANGANA CURRIES (Dinner – Other Options) ─────────────
const TELANGANA_CURRIES = [
  // 🐔 Non-Veg
  { id:'tc1',  name:'Kodi Kura (Chicken Curry)',         emoji:'🍗', kcal:320, protein:24, carbs:10, fat:18, fiber:1, iron:2.0, vitC:5,  b12:0.4, tags:['protein','south-indian'],                  cat:'telangana', note:'Classic Telangana chicken curry' },
  { id:'tc2',  name:'Natu Kodi Pulusu (Country Chicken)',emoji:'🍗', kcal:360, protein:26, carbs:12, fat:20, fiber:1, iron:2.5, vitC:6,  b12:0.6, tags:['protein','tangy','south-indian'],           cat:'telangana', note:'Country chicken — rustic & spicy 🌶️' },
  { id:'tc3',  name:'Mutton Dalcha',                     emoji:'🍖', kcal:380, protein:28, carbs:18, fat:22, fiber:4, iron:4.5, vitC:4,  b12:2.0, tags:['protein','iron','b12','south-indian'],      cat:'telangana', note:'Mutton + dal — hearty & iron-rich!' },
  { id:'tc4',  name:'Gongura Mutton',                    emoji:'🌿', kcal:380, protein:28, carbs:10, fat:24, fiber:2, iron:4.5, vitC:12, b12:2.0, tags:['protein','iron','b12','tangy','south-indian'],cat:'telangana', note:'Tangy sorrel mutton 🌶️ Telangana classic!' },
  { id:'tc5',  name:'Mutton Kura',                       emoji:'🍖', kcal:350, protein:26, carbs:8,  fat:22, fiber:1, iron:4.0, vitC:4,  b12:2.0, tags:['protein','iron','b12','south-indian'],      cat:'telangana', note:'Telangana mutton curry' },
  { id:'tc6',  name:'Chepala Pulusu (Fish Curry)',        emoji:'🐟', kcal:300, protein:22, carbs:12, fat:16, fiber:1, iron:3.0, vitC:8,  b12:3.0, tags:['iron','b12','tangy','south-indian'],        cat:'telangana', note:'Tamarind fish curry — iron & B12 ⭐' },
  { id:'tc7',  name:'Royyala Kura (Prawn Curry)',         emoji:'🦐', kcal:280, protein:20, carbs:8,  fat:16, fiber:0, iron:2.5, vitC:6,  b12:2.0, tags:['iron','b12','south-indian'],                cat:'telangana', note:'Spicy prawn curry' },
  { id:'tc8',  name:'Egg Pulusu',                        emoji:'🥚', kcal:220, protein:14, carbs:12, fat:14, fiber:1, iron:2.0, vitC:8,  b12:1.2, tags:['protein','b12','tangy','south-indian'],     cat:'telangana', note:'Tamarind egg curry — tangy!' },
  { id:'tc9',  name:'Egg Masala Curry',                  emoji:'🥚', kcal:230, protein:14, carbs:10, fat:15, fiber:1, iron:2.0, vitC:5,  b12:1.2, tags:['protein','b12','south-indian'],             cat:'telangana', note:'Spicy egg masala' },
  // 🌱 Veg
  { id:'tc10', name:'Sorakaya Pulusu (Bottle Gourd)',     emoji:'🥒', kcal:160, protein:3,  carbs:18, fat:8,  fiber:3, iron:1.2, vitC:12, b12:0,   tags:['veg','tangy','south-indian'],               cat:'telangana', note:'Light tamarind bottle gourd curry' },
  { id:'tc11', name:'Dosakaya Pappu (Yellow Cucumber Dal)',emoji:'🥒', kcal:220, protein:10, carbs:28, fat:7,  fiber:4, iron:2.8, vitC:10, b12:0,   tags:['veg','tangy','south-indian','iron'],        cat:'telangana', note:'Tangy yellow cucumber dal' },
  { id:'tc12', name:'Tomato Pappu',                      emoji:'🍅', kcal:210, protein:10, carbs:26, fat:7,  fiber:4, iron:2.5, vitC:18, b12:0,   tags:['veg','tangy','south-indian','vitaminc'],    cat:'telangana', note:'Tangy tomato dal' },
  { id:'tc13', name:'Palakura Pappu (Spinach Dal)',       emoji:'🌿', kcal:200, protein:10, carbs:22, fat:7,  fiber:5, iron:5.0, vitC:20, b12:0,   tags:['veg','iron','south-indian','vitaminc'],     cat:'telangana', note:'Iron-packed spinach dal ⭐' },
  { id:'tc14', name:'Beerakaya Kura (Ridge Gourd)',       emoji:'🥬', kcal:150, protein:3,  carbs:16, fat:8,  fiber:3, iron:1.2, vitC:10, b12:0,   tags:['veg','south-indian'],                       cat:'telangana', note:'Mild ridge gourd curry' },
  { id:'tc15', name:'Vankaya Kura (Brinjal Curry)',       emoji:'🍆', kcal:170, protein:3,  carbs:16, fat:10, fiber:4, iron:1.5, vitC:5,  b12:0,   tags:['veg','south-indian'],                       cat:'telangana', note:'Spiced brinjal curry' },
  { id:'tc16', name:'Gutti Vankaya (Stuffed Brinjal)',    emoji:'🍆', kcal:200, protein:4,  carbs:18, fat:12, fiber:4, iron:1.8, vitC:6,  b12:0,   tags:['veg','tangy','south-indian'],               cat:'telangana', note:'Masala-stuffed brinjal 💕' },
  { id:'tc17', name:'Aloo Tomato Kura',                  emoji:'🥔', kcal:200, protein:4,  carbs:26, fat:9,  fiber:3, iron:1.5, vitC:18, b12:0,   tags:['veg','south-indian','vitaminc'],            cat:'telangana', note:'Potato tomato curry' },
  { id:'tc18', name:'Chikkudukaya Kura (Broad Beans)',    emoji:'🫘', kcal:180, protein:7,  carbs:20, fat:8,  fiber:6, iron:2.5, vitC:10, b12:0,   tags:['veg','iron','fiber','south-indian'],        cat:'telangana', note:'Broad beans curry — iron & fiber!' },
  { id:'tc19', name:'Cabbage Kura',                      emoji:'🥬', kcal:140, protein:3,  carbs:14, fat:8,  fiber:4, iron:1.2, vitC:30, b12:0,   tags:['veg','south-indian','vitaminc'],            cat:'telangana', note:'Simple cabbage stir-fry' },
  { id:'tc20', name:'Carrot Beans Curry',                emoji:'🥕', kcal:150, protein:3,  carbs:18, fat:7,  fiber:5, iron:1.5, vitC:15, b12:0,   tags:['veg','south-indian','fiber'],               cat:'telangana', note:'Healthy mixed veg curry' },
  // 🌿 Bendakaya / Bhindi Variants
  { id:'tc21', name:'Bendakaya Fry',                     emoji:'🌿', kcal:155, protein:3,  carbs:13, fat:10, fiber:4, iron:1.5, vitC:16, b12:0,   tags:['veg','south-indian','fiber'],               cat:'telangana', note:'Simple okra fry with onions & spices' },
  { id:'tc22', name:'Bendakaya Pulusu',                  emoji:'🌿', kcal:170, protein:3,  carbs:18, fat:9,  fiber:4, iron:1.5, vitC:16, b12:0,   tags:['veg','tangy','south-indian'],               cat:'telangana', note:'Tamarind-based okra curry' },
  { id:'tc23', name:'Bendakaya Masala',                  emoji:'🌿', kcal:185, protein:4,  carbs:16, fat:11, fiber:4, iron:1.6, vitC:16, b12:0,   tags:['veg','south-indian'],                       cat:'telangana', note:'Onion-tomato thick okra gravy' },
  { id:'tc24', name:'Bendakaya Aloo Kura',               emoji:'🌿', kcal:210, protein:4,  carbs:24, fat:10, fiber:4, iron:1.5, vitC:18, b12:0,   tags:['veg','south-indian'],                       cat:'telangana', note:'Bhindi + potato combo' },
  { id:'tc25', name:'Bendakaya Fry with Groundnut Powder',emoji:'🌿', kcal:220, protein:7,  carbs:14, fat:14, fiber:4, iron:2.0, vitC:15, b12:0,  tags:['veg','south-indian','protein'],             cat:'telangana', note:'Okra fry with peanut crunch 🥜' },
  { id:'tc26', name:'Bendakaya Karam',                   emoji:'🌿', kcal:160, protein:3,  carbs:12, fat:11, fiber:4, iron:1.5, vitC:16, b12:0,   tags:['veg','south-indian'],                       cat:'telangana', note:'Spicy dry okra 🌶️' },
  { id:'tc27', name:'Bendakaya Onion Fry',               emoji:'🌿', kcal:175, protein:3,  carbs:15, fat:11, fiber:3, iron:1.4, vitC:14, b12:0,   tags:['veg','south-indian'],                       cat:'telangana', note:'Onion-heavy, sweet-spicy okra' },
  { id:'tc28', name:'Bendakaya Tomato Kura',             emoji:'🌿', kcal:165, protein:3,  carbs:15, fat:10, fiber:4, iron:1.5, vitC:20, b12:0,   tags:['veg','south-indian','vitaminc'],            cat:'telangana', note:'Okra in tomato gravy' },
  { id:'tc29', name:'Bendakaya Besan Curry',             emoji:'🌿', kcal:190, protein:6,  carbs:16, fat:11, fiber:4, iron:1.8, vitC:14, b12:0,   tags:['veg','south-indian'],                       cat:'telangana', note:'North-Telangana style okra besan' },
  { id:'tc30', name:'Stuffed Bendakaya',                 emoji:'🌿', kcal:200, protein:5,  carbs:14, fat:13, fiber:4, iron:1.8, vitC:15, b12:0,   tags:['veg','south-indian'],                       cat:'telangana', note:'Masala-stuffed okra 💕' },
];

// ── MORNING PRESETS ────────────────────────────────────────
const MORNING_PRESETS = [
  { id:'mo1', name:'Sprouts + Green Tea + Apple', emoji:'🌱', kcal:160, protein:8, carbs:24, fat:3, fiber:5, iron:3.0, vitC:12, b12:0, tags:['iron','fiber'], note:'Iron-rich start! ⭐' },
  { id:'mo2', name:'Mixed Fruit Bowl + Green Tea', emoji:'🍊', kcal:100, protein:1, carbs:24, fat:0, fiber:3, iron:0.5, vitC:40, b12:0, tags:['vitaminc','light'], note:'Light & refreshing' },
  { id:'mo3', name:'Banana + Almonds + Green Tea', emoji:'🍌', kcal:155, protein:5, carbs:22, fat:6, fiber:3, iron:1.0, vitC:9, b12:0, tags:['energy'], note:'Good energy boost' },
  { id:'mo4', name:'Guava + Peanuts', emoji:'🫐', kcal:130, protein:5, carbs:16, fat:5, fiber:6, iron:1.5, vitC:220, b12:0, tags:['iron','vitaminc'], note:'Iron + Vitamin C combo!' },
  { id:'mo5', name:'Papaya + Green Tea', emoji:'🍈', kcal:85, protein:1, carbs:20, fat:0, fiber:3, iron:0.3, vitC:60, b12:0, tags:['fiber','vitaminc'], note:'Great for digestion' },
  { id:'mo6', name:'Sprouts Chaat (tangy!)', emoji:'🌿', kcal:140, protein:8, carbs:18, fat:3, fiber:5, iron:3.0, vitC:15, b12:0, tags:['iron','tangy'], note:'Tangy spicy sprouts 🌶️' },
  { id:'mo7', name:'Nutella Toast', emoji:'🍫', kcal:220, protein:4, carbs:30, fat:10, fiber:2, iron:1.5, vitC:0, b12:0, tags:['veg'], note:'Chocolate hazelnut spread on toast' },
  { id:'mo8', name:'Peanut Butter Toast', emoji:'🥜', kcal:200, protein:8, carbs:22, fat:10, fiber:3, iron:1.2, vitC:0, b12:0, tags:['veg','protein'], note:'Protein-rich toast' },
  { id:'mo9', name:'Butter Toast + Jam', emoji:'🍞', kcal:180, protein:4, carbs:28, fat:6, fiber:1, iron:1.0, vitC:0, b12:0, tags:['veg'], note:'Classic breakfast' },
  { id:'mo10', name:'Avocado Toast', emoji:'🥑', kcal:210, protein:5, carbs:20, fat:13, fiber:5, iron:1.0, vitC:10, b12:0, tags:['veg','fiber','light'], note:'Healthy fats' },
  { id:'mo11', name:'Poha', emoji:'🍚', kcal:180, protein:4, carbs:32, fat:4, fiber:2, iron:2.0, vitC:5, b12:0, tags:['veg','south-indian'], note:'Light & easy to digest' },
  { id:'mo12', name:'Upma', emoji:'🥣', kcal:200, protein:5, carbs:34, fat:6, fiber:3, iron:1.5, vitC:5, b12:0, tags:['veg','south-indian'], note:'Classic South Indian breakfast' },
  { id:'mo13', name:'Oats with Banana', emoji:'🌾', kcal:220, protein:7, carbs:40, fat:4, fiber:6, iron:2.5, vitC:5, b12:0, tags:['veg','iron','fiber'], note:'Filling & iron-rich' },
  { id:'mo14', name:'Boiled Eggs (2)', emoji:'🥚', kcal:140, protein:12, carbs:1, fat:10, fiber:0, iron:1.8, vitC:0, b12:1.2, tags:['protein','b12','iron'], note:'Best protein breakfast' },
];

// Coffee options
const COFFEE_PRESETS = [
  { id:'cf1', name:'Instant Coffee', emoji:'☕', kcal:45, protein:1, carbs:5, fat:2, fiber:0, iron:0, vitC:0, b12:0, tags:[], note:'Her usual office coffee' },
  { id:'cf2', name:'Black Coffee', emoji:'☕', kcal:5, protein:0, carbs:0, fat:0, fiber:0, iron:0, vitC:0, b12:0, tags:['light'], note:'Zero cal — best for iron!' },
  { id:'cf3', name:'Green Tea', emoji:'🍵', kcal:2, protein:0, carbs:0, fat:0, fiber:0, iron:0, vitC:0, b12:0, tags:['light'], note:'Better iron absorption' },
  { id:'cf4', name:'Lemon Water', emoji:'🍋', kcal:10, protein:0, carbs:3, fat:0, fiber:0, iron:0, vitC:15, b12:0, tags:['vitaminc','light'], note:'Boosts iron absorption' },
];

// Treats
const TREAT_OPTIONS = [
  { id:'tr1', name:'Pani Puri 🎉', emoji:'🫙', kcal:200, protein:3, carbs:30, fat:7, fiber:1, iron:0.8, vitC:3, b12:0, isTreat:true, tags:['tangy'], note:'Allowed occasionally!' },
  { id:'tr2', name:'Bhel Puri 🎉', emoji:'🍿', kcal:180, protein:4, carbs:28, fat:6, fiber:2, iron:1.0, vitC:5, b12:0, isTreat:true, tags:['tangy'], note:'Tangy treat!' },
  { id:'tr3', name:'Ice Cream 🍦', emoji:'🍦', kcal:180, protein:3, carbs:22, fat:9, fiber:0, iron:0.2, vitC:0, b12:0.2, isTreat:true, tags:[], note:'One small scoop!' },
  { id:'tr4', name:'Waffle + Maple Syrup', emoji:'🧇', kcal:320, protein:6, carbs:48, fat:12, fiber:1, iron:1.0, vitC:0, b12:0, isTreat:true, tags:[], note:'Occasional treat only!' },
];

// Local Indian foods for search
const INDIAN_FOODS_DB = [
  { name:'Idli (1 piece)', kcal:50, protein:2, carbs:10, fat:0.2, fiber:0.5, iron:0.3, vitC:0, b12:0, emoji:'🫙' },
  { name:'Dosa (plain)', kcal:120, protein:3, carbs:22, fat:3, fiber:1, iron:0.8, vitC:0, b12:0, emoji:'🫓' },
  { name:'Masala Dosa', kcal:220, protein:5, carbs:32, fat:8, fiber:2, iron:1.5, vitC:6, b12:0, emoji:'🫓' },
  { name:'Sambar (bowl)', kcal:80, protein:4, carbs:12, fat:2, fiber:3, iron:1.5, vitC:5, b12:0, emoji:'🍲' },
  { name:'Upma (cup)', kcal:200, protein:5, carbs:32, fat:6, fiber:2, iron:1.2, vitC:0, b12:0, emoji:'🥣' },
  { name:'Poha (cup)', kcal:175, protein:4, carbs:30, fat:5, fiber:2, iron:5.0, vitC:0, b12:0, emoji:'🥘' },
  { name:'Curd Rice (cup)', kcal:220, protein:6, carbs:34, fat:6, fiber:1, iron:0.5, vitC:1, b12:0.3, emoji:'🍚' },
  { name:'Rasam (bowl)', kcal:60, protein:2, carbs:10, fat:1, fiber:1, iron:1.0, vitC:8, b12:0, emoji:'🍲' },
  { name:'Pesarattu (1)', kcal:140, protein:7, carbs:18, fat:4, fiber:3, iron:2.0, vitC:3, b12:0, emoji:'🫓' },
  { name:'Chapati (1)', kcal:80, protein:3, carbs:16, fat:1, fiber:2, iron:1.0, vitC:0, b12:0, emoji:'🫓' },
  { name:'Rice (cup cooked)', kcal:200, protein:4, carbs:44, fat:0.5, fiber:0.5, iron:0.6, vitC:0, b12:0, emoji:'🍚' },
  { name:'Egg (boiled)', kcal:70, protein:6, carbs:0.5, fat:5, fiber:0, iron:0.9, vitC:0, b12:0.6, emoji:'🥚' },
  { name:'Chicken curry (100g)', kcal:180, protein:16, carbs:6, fat:10, fiber:1, iron:1.5, vitC:4, b12:0.3, emoji:'🍗' },
  { name:'Fish curry (100g)', kcal:150, protein:18, carbs:4, fat:7, fiber:0, iron:2.0, vitC:3, b12:2.0, emoji:'🐟' },
  { name:'Prawn curry (100g)', kcal:130, protein:16, carbs:3, fat:6, fiber:0, iron:2.5, vitC:4, b12:1.5, emoji:'🦐' },
  { name:'Dal (cup)', kcal:190, protein:10, carbs:28, fat:4, fiber:5, iron:3.0, vitC:3, b12:0, emoji:'🍛' },
  { name:'Gongura Dal (cup)', kcal:170, protein:8, carbs:24, fat:5, fiber:4, iron:3.5, vitC:12, b12:0, emoji:'🍅' },
  { name:'Tomato curry (100g)', kcal:80, protein:2, carbs:10, fat:4, fiber:2, iron:1.0, vitC:15, b12:0, emoji:'🍅' },
  { name:'Sprouts (100g)', kcal:80, protein:5, carbs:12, fat:1, fiber:4, iron:2.0, vitC:10, b12:0, emoji:'🌱' },
  { name:'Paneer (50g)', kcal:150, protein:9, carbs:2, fat:12, fiber:0, iron:0.5, vitC:0, b12:0.2, emoji:'🧀' },
  { name:'Apple', kcal:80, protein:0.5, carbs:20, fat:0, fiber:3, iron:0.2, vitC:7, b12:0, emoji:'🍎' },
  { name:'Banana', kcal:90, protein:1, carbs:22, fat:0, fiber:2, iron:0.3, vitC:9, b12:0, emoji:'🍌' },
  { name:'Coconut Water', kcal:45, protein:1, carbs:10, fat:0, fiber:0, iron:0.3, vitC:3, b12:0, emoji:'🥥' },
  { name:'Buttermilk (glass)', kcal:40, protein:3, carbs:5, fat:1, fiber:0, iron:0.1, vitC:1, b12:0.2, emoji:'🥛' },
  { name:'Pani Puri (6 pcs)', kcal:200, protein:3, carbs:30, fat:7, fiber:1, iron:0.8, vitC:3, b12:0, emoji:'🫙' },
  { name:'Ice Cream (scoop)', kcal:180, protein:3, carbs:22, fat:9, fiber:0, iron:0.2, vitC:0, b12:0.2, emoji:'🍦' },
  { name:'Tandoori Chicken (100g)', kcal:200, protein:24, carbs:4, fat:10, fiber:0, iron:1.8, vitC:3, b12:0.4, emoji:'🍗' },
  { name:'Biryani (cup)', kcal:300, protein:12, carbs:40, fat:10, fiber:1, iron:1.5, vitC:3, b12:0.2, emoji:'🍚' },
  { name:'Tamarind Rice (cup)', kcal:280, protein:4, carbs:48, fat:8, fiber:1, iron:1.2, vitC:4, b12:0, emoji:'🍚' },
  { name:'Almonds (10)', kcal:70, protein:3, carbs:2, fat:6, fiber:1, iron:0.5, vitC:0, b12:0, emoji:'🥜' },
  { name:'Coffee with milk', kcal:45, protein:1, carbs:5, fat:2, fiber:0, iron:0, vitC:0, b12:0, emoji:'☕' },
  { name:'Green Tea', kcal:2, protein:0, carbs:0, fat:0, fiber:0, iron:0, vitC:0, b12:0, emoji:'🍵' },
];

const SUPPLEMENTS = [
  { id:'iron_b12', label:'Iron + B12', time:'7:30 AM', timeLabel:'with Morning Meal',
    triggerH:7, triggerM:30, icon:'🩸', color:'#B71C1C', note:'Take with food, NOT with coffee!' },
  { id:'mag_d3', label:'Magnesium + D3', time:'10:30 PM', timeLabel:'before Sleep',
    triggerH:22, triggerM:30, icon:'✨', color:'#6A1B9A', note:'Take 30 min before sleeping' },
];

const CELEBRATION_MSGS = [
  "Dudu is SO proud of you! 🥰", "One meal closer to 55 kg! 💪",
  "That's my Bubu! Eating healthy! 🎉", "Dudu loves you so much Bubu! 💕",
  "Iron + B12 loading… You're doing great! ✨", "Keep it up! Every meal counts! 🌟",
];

// ── SMART RECOMMENDATION ENGINE ────────────────────────────
function isHomeDay() {
  const day = new Date().getDay();
  return day === 0 || day === 1 || day === 6; // Sun, Mon, Sat
}

function getRecommendations(slotKey, isFast) {
  const isHome = isHomeDay();
  const recs = { recommended: [], other: [], treats: [] };

  if (slotKey === 'morning') {
    const nuts = { id:'snh3', name:'Mixed Nuts (handful)', emoji:'🥜', kcal:160, protein:6, carbs:8, fat:14, fiber:2, iron:1.5, vitC:0, b12:0, tags:['iron','protein'], note:'Almonds + walnuts' };
    recs.recommended = [...MORNING_PRESETS, nuts];
    // Always show canteen options for breakfast (home or office)
    recs.other = [...CANTEEN.south_indian, ...CANTEEN.eggs, ...CANTEEN.cereals, ...CANTEEN.fruits, ...CANTEEN.dessert];
  } else if (slotKey === 'coffee') {
    recs.recommended = [...COFFEE_PRESETS];
    if (!isHome) {
      recs.other = [...CANTEEN.drinks];
    }
  } else if (slotKey === 'lunch') {
    if (isHome) {
      // Home days: Telugu home food as recommended
      recs.recommended = HOME_DINNERS.filter(d => d.tags.includes('south-indian') || d.tags.includes('iron'));
    } else {
      // Office: build smart recommendations
      const picks = [];
      const ironRich = getAllCanteenItems().filter(i => i.tags.includes('iron') && i.kcal <= 450);
      picks.push(...ironRich.slice(0, 3));
      const tangy = getAllCanteenItems().filter(i => i.tags.includes('tangy') && !picks.find(p=>p.id===i.id));
      picks.push(...tangy.slice(0, 2));
      const protein = getAllCanteenItems().filter(i => i.tags.includes('protein') && i.kcal <= 500 && !picks.find(p=>p.id===i.id));
      picks.push(...protein.slice(0, 3));
      const light = getAllCanteenItems().filter(i => i.tags.includes('light') && !picks.find(p=>p.id===i.id));
      picks.push(...light.slice(0, 2));
      recs.recommended = picks;
    }
    // Always show full canteen as "other" options (home or office)
    const recIds = new Set(recs.recommended.map(p=>p.id));
    recs.other = getAllCanteenItems().filter(i => !recIds.has(i.id) && !i.isTreat);
    if (isFast) {
      recs.recommended = recs.recommended.filter(i => i.tags.includes('veg'));
      recs.other = recs.other.filter(i => i.tags.includes('veg'));
    }
  } else if (slotKey === 'snack') {
    if (isHome) {
      recs.recommended = [
        ...CANTEEN.fruits,
        { id:'snh1', name:'Fresh Fruit', emoji:'🍎', kcal:80, protein:0.5, carbs:20, fat:0, fiber:3, iron:0.2, vitC:15, b12:0, tags:['veg','vitaminc'], note:'Seasonal fruit' },
        { id:'snh2', name:'Cucumber + Chaat Masala', emoji:'🥒', kcal:25, protein:1, carbs:4, fat:0, fiber:1, iron:0.3, vitC:5, b12:0, tags:['veg','tangy','light'], note:'Tangy & crunchy!' },
        { id:'snh3', name:'Mixed Nuts (handful)', emoji:'🥜', kcal:160, protein:6, carbs:8, fat:14, fiber:2, iron:1.5, vitC:0, b12:0, tags:['iron','protein'], note:'Almonds + walnuts' },
        { id:'snh4', name:'Herbal Tea', emoji:'🍵', kcal:5, protein:0, carbs:1, fat:0, fiber:0, iron:0, vitC:0, b12:0, tags:['light'], note:'Tulsi / Ginger' },
      ];
    } else {
      // Office snacks: chaat, fruits, drinks, desserts
      recs.recommended = [...CANTEEN.fruits, ...CANTEEN.drinks.filter(d=>d.kcal<=80)];
    }
    // Always show canteen snack options as "other" (home or office)
    const snackRecIds = new Set(recs.recommended.map(p=>p.id));
    recs.other = [...CANTEEN.chaat.filter(c=>!c.isTreat), ...CANTEEN.dessert, ...CANTEEN.drinks.filter(d=>d.kcal>80)].filter(i=>!snackRecIds.has(i.id));
    recs.treats = isFast
      ? [TREAT_OPTIONS[0]] // pani puri on fast day
      : TREAT_OPTIONS;
    if (isFast) {
      recs.recommended = recs.recommended.filter(i => i.tags.includes('veg'));
      recs.other = recs.other.filter(i => i.tags.includes('veg'));
    }
  } else if (slotKey === 'dinner') {
    recs.recommended = [...HOME_DINNERS];
    // Always show Telangana curries as other options
    recs.other = [...TELANGANA_CURRIES];
    if (!isHome) {
      // Can still get canteen food for late office dinners
      recs.other = [...recs.other, ...CANTEEN.hearth_curries, ...CANTEEN.hearth_chicken, ...CANTEEN.hearth_veg, ...CANTEEN.hearth_bread];
    }
    if (isFast) {
      recs.recommended = recs.recommended.filter(i => i.tags.includes('veg') || i.tags.includes('south-indian'));
      recs.other = recs.other.filter(i => i.tags.includes('veg'));
    }
  }

  // Rotate by day for variety
  const dayShift = new Date().getDay();
  recs.recommended = rotateArray(recs.recommended, dayShift);
  recs.other = rotateArray(recs.other, dayShift);

  return recs;
}

function getAllCanteenItems() {
  return [
    ...CANTEEN.salads, ...CANTEEN.sandwiches, ...CANTEEN.mains,
    ...CANTEEN.bowls_grains, ...CANTEEN.bowls_protein, ...CANTEEN.bowls_veggies,
    ...CANTEEN.hearth_chicken, ...CANTEEN.hearth_veg, ...CANTEEN.hearth_curries,
    ...CANTEEN.hearth_bread, ...CANTEEN.south_indian, ...CANTEEN.eggs,
    ...CANTEEN.global, ...CANTEEN.drinks, ...CANTEEN.fruits,
    ...CANTEEN.dessert, ...CANTEEN.cereals, ...CANTEEN.specials,
  ];
}

function rotateArray(arr, shift) {
  if (!arr.length) return arr;
  const s = shift % arr.length;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

// ── DOM REFS ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const loadingScreen     = $('loading-screen');
const app               = $('app');
const headerTitle       = $('header-title');
const headerSub         = $('header-sub');
const userInfo          = $('user-info');
const userGreeting      = $('user-greeting');
const loginBtn          = $('login-btn');
const logoutBtn         = $('logout-btn');
const dateDisplay       = $('date-display');
const timeDisplay       = $('time-display');
const fastDayBadge      = $('fast-day-badge');
const heroImage         = $('hero-image');
const mealBadge         = $('meal-badge');
const mealTitle         = $('meal-title');
const mealTimeTag       = $('meal-time-tag');
const heroSuppHint      = $('hero-supp-hint');
const heroLogged        = $('hero-logged');
const heroLoggedItems   = $('hero-logged-items');
const heroLoggedKcal    = $('hero-logged-kcal');
const heroEditBtn       = $('hero-edit-btn');
const heroPrompt        = $('hero-prompt');
const heroLogBtn        = $('hero-log-btn');
const promptQuestion    = $('prompt-question');
const missedBanner      = $('missed-meal-banner');
const missedBannerText  = $('missed-banner-text');
const mealTimeline      = $('meal-timeline');
const calorieCircle     = $('calorie-ring-circle');
const caloriesConsumed  = $('calories-consumed');
const caloriesRemaining = $('calories-remaining');
const logEntriesList    = $('log-entries-list');
const btnLogNow         = $('btn-log-now');
const weightProgressFill= $('weight-progress-fill');
const progressText      = $('progress-text');
const currentWeightDisp = $('current-weight-display');
const weightNote        = $('weight-note');
const weightUpdateArea  = $('weight-update-area');
const weightInput       = $('weight-input');
const saveWeightBtn     = $('save-weight-btn');
const footerMsg         = $('footer-msg');
const footerSmall       = $('footer-small');
const adminFab          = $('admin-fab');
const adminOverlay      = $('admin-overlay');
const adminPanel        = $('admin-panel');
const closeAdminBtn     = $('close-admin-btn');
const adminDateInput    = $('admin-date-input');
const fastDayToggle     = $('fast-day-toggle');
const adminDayNotes     = $('admin-day-notes');
const savePlanBtn       = $('save-plan-btn');
const saveStatus        = $('save-status');
const mealTapModal      = $('meal-tap-modal');
const closeMealTapBtn   = $('close-meal-tap-btn');
const mealTapEmoji      = $('meal-tap-emoji');
const mealTapTitle      = $('meal-tap-title');
const mealTapTime       = $('meal-tap-time');
const modalSuppHint     = $('modal-supp-hint');
const foodOptionGrid    = $('food-option-grid');
const adminPicksSec     = $('admin-picks-section');
const adminFoodOptions  = $('admin-food-options');
const treatSection      = $('treat-section');
const treatOptions      = $('treat-options');
const recentSection     = $('recent-section');
const recentOptions     = $('recent-options');
const selectionBar      = $('selection-bar');
const selCount          = $('sel-count');
const selKcal           = $('sel-kcal');
const mealKcalLimit     = $('meal-kcal-limit');
const logSelectionBtn   = $('log-selection-btn');
const openFoodSearchBtn = $('open-food-search-btn');
const foodSearchModal   = $('food-search-modal');
const closeFoodSearchBtn= $('close-food-search-btn');
const foodSearchInput   = $('food-search-input');
const foodSearchBtn     = $('food-search-btn');
const searchSpinner     = $('search-spinner');
const searchResultsList = $('search-results-list');
const searchEmptyMsg    = $('search-empty-msg');
const manualFoodName    = $('manual-food-name');
const manualFoodKcal    = $('manual-food-kcal');
const addManualFoodBtn  = $('add-manual-food-btn');
const supplementStrip   = $('supplement-strip');
const supplementModal   = $('supplement-modal');
const closeSuppModalBtn = $('close-supplement-modal-btn');
const suppModalIcon     = $('supp-modal-icon');
const suppModalTitle    = $('supp-modal-title');
const suppModalSubtitle = $('supp-modal-subtitle');
const suppModalNote     = $('supp-modal-note');
const suppNotTakenArea  = $('supp-not-taken-area');
const markSuppTakenBtn  = $('mark-supp-taken-btn');
const suppTakenArea     = $('supp-taken-area');
const suppTakenTimeLabel= $('supp-taken-time-label');
const loginModal        = $('login-modal');
const closeLoginModal   = $('close-login-modal');
const loginEmail        = $('login-email');
const loginPassword     = $('login-password');
const submitLoginBtn    = $('submit-login-btn');
const loginError        = $('login-error');
const celebrationOverlay= $('celebration-overlay');
const celebrationMsg    = $('celebration-msg');
const closeCelebrationBtn=$('close-celebration-btn');
const confettiContainer = $('confetti-container');
const warningOverlay    = $('warning-overlay');
const warningMsg        = $('warning-msg');
const closeWarningBtn   = $('close-warning-btn');

// Nutrition chart refs
const nutriProteinBar   = $('nutri-protein-bar');
const nutriIronBar      = $('nutri-iron-bar');
const nutriVitCBar      = $('nutri-vitc-bar');
const nutriB12Bar       = $('nutri-b12-bar');
const nutriFiberBar     = $('nutri-fiber-bar');
const nutriProteinVal   = $('nutri-protein-val');
const nutriIronVal      = $('nutri-iron-val');
const nutriVitCVal      = $('nutri-vitc-val');
const nutriB12Val       = $('nutri-b12-val');
const nutriFiberVal     = $('nutri-fiber-val');

// ── DATE HELPERS ───────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2,'0'); }
function formatDisplayDate(d) {
  return d.toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}
function isFastDayDate(d) { const day = d.getDay(); return day===2||day===4; }
function minsNow() { const n=new Date(); return n.getHours()*60+n.getMinutes(); }
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// ── BOOT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  spawnParticles();
  startClock();
  setupEventListeners();
  initEmailReminders();
  loadRecentlyLogged();
  setTimeout(() => {
    // Set persistence so Bubu stays logged in on iPhone
    if (auth.setPersistence && typeof firebase !== 'undefined' && firebase.auth?.Auth?.Persistence) {
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
    }
    auth.onAuthStateChanged(handleAuthChange);
  }, 2800);
});

function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}
function updateClock() {
  const now = new Date();
  dateDisplay.textContent = formatDisplayDate(now);
  timeDisplay.textContent = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

function spawnParticles() {
  const items = ['🌶️','🍅','🦐','🐟','🍋','🥘','🫙','🌿','🧅','🧄','🍃','✨','🌊','🍽️','🫐','🥜'];
  const container = $('food-particles');
  for (let i=0; i<18; i++) {
    const el = document.createElement('span');
    el.className = 'particle';
    el.textContent = items[Math.floor(Math.random()*items.length)];
    el.style.left = `${Math.random()*100}%`;
    el.style.animationDuration = `${10+Math.random()*18}s`;
    el.style.animationDelay = `${Math.random()*14}s`;
    el.style.fontSize = `${1+Math.random()*1.2}rem`;
    container.appendChild(el);
  }
}

// ── AUTH ───────────────────────────────────────────────────
async function handleAuthChange(user) {
  if (user) {
    state.user = user;
    if (user.email === ADMIN_EMAIL) {
      state.role='admin'; state.realName='Pranay'; state.nickname='Dudu';
    } else if (user.email === BUBU_EMAIL) {
      state.role='bubu'; state.realName='Priyanka'; state.nickname='Bubu';
    } else {
      state.role='guest';
    }
    loginBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    // Hide logout for Bubu — she stays logged in
    if (state.role === 'bubu') {
      userGreeting.textContent = `Hi Priyanka 🥰`;
      headerTitle.textContent  = "Priyanka's Diet Plan";
      footerSmall.textContent  = "Made with love by Pranay 🍽️";
      logoutBtn.classList.add('hidden');
    } else if (state.role === 'admin') {
      userGreeting.textContent = `Dudu's Panel 🍳`;
      adminFab.classList.remove('hidden');
      weightUpdateArea.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
    }
    // Migrate any local logs to Firestore
    migrateLocalLogs();
  } else {
    state.user=null; state.role=null;
    loginBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');
    adminFab.classList.add('hidden');
    headerTitle.textContent = "Bubu's Diet Plan";
    footerSmall.textContent = "Made with love by Dudu 🍽️";
  }
  await loadPage();
  dismissLoading();
  initSupplementStrip();
}

async function login(email, password) {
  try {
    loginError.classList.add('hidden');
    submitLoginBtn.textContent = 'Logging in…';
    submitLoginBtn.disabled = true;
    await auth.signInWithEmailAndPassword(email, password);
    closeLoginModalFn();
  } catch(e) {
    let msg = 'Wrong email or password. Try again!';
    if (e.code === 'auth/user-not-found') msg = 'No account found. Ask Dudu to set up your login!';
    else if (e.code === 'auth/too-many-requests') msg = 'Too many attempts. Wait a minute and try again.';
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
  } finally {
    submitLoginBtn.textContent = 'Login';
    submitLoginBtn.disabled = false;
  }
}
async function logout() {
  await auth.signOut();
  closeAdminPanelFn();
}

// Migrate localStorage logs to Firestore on login
async function migrateLocalLogs() {
  if (!state.user) return;
  const key = `meal_log_${todayStr()}`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (Object.keys(data).length > 0) {
      await db.collection('meal_logs').doc(todayStr()).set(data, { merge: true });
      localStorage.removeItem(key);
    }
  } catch(e) {}
}

// ── PAGE LOAD ──────────────────────────────────────────────
async function loadPage() {
  const dateKey = todayStr();
  const today   = new Date();

  try {
    const doc = await db.collection('diet_plans').doc(dateKey).get();
    state.todayPlan = doc.exists ? doc.data() : null;
  } catch(e) { state.todayPlan = null; }

  try {
    const logDoc = await db.collection('meal_logs').doc(dateKey).get();
    const raw = logDoc.exists ? logDoc.data() : loadLocalLog();
    // Only use data if it matches today's date (guard against stale cache)
    state.todayLog = (raw && raw.date === dateKey) ? raw : {};
  } catch(e) {
    const raw = loadLocalLog();
    state.todayLog = (raw && raw.date === dateKey) ? raw : {};
  }

  try {
    const snap = await db.collection('settings').doc('weight').get();
    if (snap.exists) state.currentWeight = snap.data().current || 65;
  } catch(e) {}

  const isFast = state.todayPlan?.isFastDay ?? isFastDayDate(today);
  renderHero(isFast);
  renderTimeline(isFast);
  renderFoodLogSection();
  renderNutritionChart();
  renderWeightTracker();
  renderFastBadge(isFast);
  renderMissedMealBanner();
  renderFooter();
  scheduleReminderChecks();
  loadHistory();
}

function dismissLoading() {
  loadingScreen.classList.add('fade-out');
  app.classList.remove('hidden');
  supplementStrip.classList.remove('hidden');
  setTimeout(() => { loadingScreen.style.display='none'; }, 900);
}

// ── RECENTLY LOGGED ────────────────────────────────────────
function loadRecentlyLogged() {
  try {
    state.recentlyLogged = JSON.parse(localStorage.getItem('bubu_recent_foods') || '[]');
  } catch(e) { state.recentlyLogged = []; }
}
function saveRecentlyLogged(items) {
  const existing = state.recentlyLogged;
  items.forEach(item => {
    const idx = existing.findIndex(e => e.name === item.name);
    if (idx >= 0) existing.splice(idx, 1);
    existing.unshift({ id:item.id, name:item.name, emoji:item.emoji, kcal:item.kcal,
      protein:item.protein||0, carbs:item.carbs||0, fat:item.fat||0, fiber:item.fiber||0,
      iron:item.iron||0, vitC:item.vitC||0, b12:item.b12||0 });
  });
  state.recentlyLogged = existing.slice(0, 15);
  localStorage.setItem('bubu_recent_foods', JSON.stringify(state.recentlyLogged));
}

// ── LOCAL LOG FALLBACK ─────────────────────────────────────
function loadLocalLog() {
  const raw = localStorage.getItem(`meal_log_${todayStr()}`);
  return raw ? JSON.parse(raw) : {};
}
function saveLocalLog(data) {
  localStorage.setItem(`meal_log_${todayStr()}`, JSON.stringify(data));
}

// ── MISSED MEAL BANNER ─────────────────────────────────────
async function renderMissedMealBanner() {
  if (!missedBanner) return;
  const mins = minsNow();
  let missed = 0;
  const log = state.todayLog || {};

  // Check today's past meals
  Object.entries(MEAL_WINDOWS).forEach(([key, win]) => {
    if (mins > win.end && (!log[key]?.items?.length)) missed++;
  });

  // Check yesterday's unlogged meals (only if doc exists — i.e. app was used yesterday)
  try {
    const yDoc = await db.collection('meal_logs').doc(yesterdayStr()).get();
    if (yDoc.exists) {
      const yLog = yDoc.data();
      Object.keys(MEAL_WINDOWS).forEach(key => {
        if (!yLog[key]?.items?.length) missed++;
      });
    }
  } catch(e) {}

  if (missed > 0) {
    missedBannerText.textContent = `${missed} meal${missed>1?'s':''} missed in the last 24 hours! Dudu is worried 😟`;
    missedBanner.classList.remove('hidden');
  } else {
    missedBanner.classList.add('hidden');
  }
}

// ── HERO SECTION ───────────────────────────────────────────
function renderHero(isFast) {
  const { meal, next } = getCurrentMealInfo();

  if (isFast) {
    heroImage.src = MEAL_IMAGES.fast;
    mealBadge.textContent = '🥄 Fast Day!';
    mealTitle.textContent = 'Pani Puri Day!';
    mealTimeTag.textContent = 'Light eating — veg only · pani puri allowed 🎉';
    heroPrompt.classList.remove('hidden');
    heroLogged.classList.add('hidden');
    promptQuestion.textContent = 'What are you having today?';
    heroLogBtn.textContent = '🍽️ Log Meal';
    heroLogBtn.onclick = () => openMealTapModal(meal || 'snack', true);
    heroSuppHint.classList.add('hidden');
    return;
  }

  const slot = meal || next;
  if (slot) {
    heroImage.src = MEAL_IMAGES[slot];
    mealBadge.textContent = meal ? `${MEAL_WINDOWS[slot].emoji} ${MEAL_WINDOWS[slot].label} Time!` : `⏭️ Next: ${MEAL_WINDOWS[slot].label}`;
    mealTitle.textContent = MEAL_WINDOWS[slot].label;
    mealTimeTag.textContent = MEAL_WINDOWS[slot].time;
    const supp = SUPPLEMENTS.find(s => s.id==='iron_b12' && slot==='morning');
    if (supp) {
      heroSuppHint.textContent = `💊 Take your ${supp.label} with this meal!`;
      heroSuppHint.classList.remove('hidden');
    } else { heroSuppHint.classList.add('hidden'); }
    const logEntry = state.todayLog?.[slot];
    if (logEntry?.items?.length) {
      renderHeroLogged(slot, logEntry);
    } else {
      heroLogged.classList.add('hidden');
      heroPrompt.classList.remove('hidden');
      promptQuestion.textContent = meal ? 'What are you eating? 🍽️' : 'Prep for your next meal!';
      heroLogBtn.textContent = '🍽️ Log This Meal';
      heroLogBtn.onclick = () => openMealTapModal(slot, false);
    }
  } else {
    heroImage.src = MEAL_IMAGES.default;
    mealBadge.textContent = '🌙 Good Night!';
    mealTitle.textContent = 'All Done Today!';
    mealTimeTag.textContent = 'Rest well Bubu 😴';
    heroPrompt.classList.add('hidden');
    heroLogged.classList.add('hidden');
    heroSuppHint.classList.add('hidden');
  }
}

function renderHeroLogged(slot, logEntry) {
  heroPrompt.classList.add('hidden');
  heroLogged.classList.remove('hidden');
  heroLoggedItems.innerHTML = logEntry.items.map(it =>
    `<div class="logged-chip"><span class="logged-chip-emoji">${it.emoji||'🍽️'}</span><span class="logged-chip-name">${escHtml(it.name)}</span><span class="logged-chip-kcal">${it.kcal} kcal</span></div>`
  ).join('');
  heroLoggedKcal.textContent = `Total: ${logEntry.totalKcal || 0} kcal`;
  heroEditBtn.onclick = () => openMealTapModal(slot, isFastDayDate(new Date()));
}

// ── MEAL TAP MODAL ─────────────────────────────────────────
function openMealTapModal(slotKey, isFast) {
  // REQUIRE LOGIN
  if (!state.user) {
    loginModal.classList.remove('hidden');
    return;
  }

  state.activeTapSlot = slotKey;
  state.pendingSelections = [];
  const win = MEAL_WINDOWS[slotKey] || MEAL_WINDOWS.morning;

  mealTapEmoji.textContent  = win.emoji;
  mealTapTitle.textContent  = win.label;
  mealTapTime.textContent   = win.time;

  // Show per-meal calorie limit
  if (mealKcalLimit) mealKcalLimit.textContent = `Target: ~${win.kcalLimit} kcal`;

  // Supplement hint
  const supp = SUPPLEMENTS.find(s => s.id==='iron_b12' && slotKey==='morning');
  if (supp) {
    modalSuppHint.textContent = `💊 Don't forget your ${supp.label} with this meal!`;
    modalSuppHint.classList.remove('hidden');
  } else { modalSuppHint.classList.add('hidden'); }

  // Pre-fill with existing log
  const existing = state.todayLog?.[slotKey];
  if (existing?.items) state.pendingSelections = [...existing.items];

  renderFoodOptionGrid(slotKey, isFast);
  updateSelectionBar();

  mealTapModal.querySelector('.modal-box-wide').scrollTop = 0;
  mealTapModal.classList.remove('hidden');
}

function renderFoodOptionGrid(slotKey, isFast) {
  const recs = getRecommendations(slotKey, isFast);

  // Remove any existing veg label
  const prev = foodOptionGrid.parentNode.querySelector('.veg-only-label');
  if (prev) prev.remove();

  if (isFast && (slotKey === 'lunch' || slotKey === 'dinner')) {
    const vegLabel = document.createElement('div');
    vegLabel.className = 'veg-only-label';
    vegLabel.textContent = '🌿 Veg Only Today (Fast Day)';
    foodOptionGrid.parentNode.insertBefore(vegLabel, foodOptionGrid);
  }

  // Recommended options
  foodOptionGrid.innerHTML = recs.recommended.map(item => buildOptionCard(item)).join('');

  // Recently logged section
  if (state.recentlyLogged.length > 0 && recentSection && recentOptions) {
    const recentForSlot = state.recentlyLogged.slice(0, 6);
    if (recentForSlot.length) {
      recentSection.classList.remove('hidden');
      recentOptions.innerHTML = recentForSlot.map(item => buildOptionCard({
        ...item, id: 'recent_' + item.name.replace(/\s/g,'_'), tags: [], note: 'Recently logged'
      })).join('');
    } else {
      recentSection.classList.add('hidden');
    }
  }

  // Other canteen options (collapsible)
  const otherGrid = $('other-options');
  const otherSection = $('other-section');
  if (recs.other.length && otherGrid && otherSection) {
    otherSection.classList.remove('hidden');
    otherGrid.innerHTML = recs.other.map(item => buildOptionCard(item)).join('');
  } else if (otherSection) {
    otherSection.classList.add('hidden');
  }

  // Admin picks from Firestore
  const adminItems = state.todayPlan?.meals?.[slotKey]?.items || [];
  if (adminItems.length) {
    adminPicksSec.classList.remove('hidden');
    adminFoodOptions.innerHTML = adminItems.map(it => buildOptionCard({
      id:'admin_'+it.name, name:it.name, emoji:'💕', kcal:it.kcal||0, protein:0, carbs:0, fat:0, fiber:0, iron:0, vitC:0, b12:0, note:it.description||'', tags:[]
    })).join('');
  } else {
    adminPicksSec.classList.add('hidden');
  }

  // Treats
  if (recs.treats.length) {
    treatSection.classList.remove('hidden');
    treatOptions.innerHTML = recs.treats.map(item => buildOptionCard(item)).join('');
  } else {
    treatSection.classList.add('hidden');
  }

  // Mark already selected
  state.pendingSelections.forEach(sel => {
    const card = mealTapModal.querySelector(`[data-id="${sel.id}"]`);
    if (card) card.classList.add('selected');
  });
}

function buildOptionCard(item) {
  const tagHtml = buildTagPills(item.tags || []);
  return `<div class="food-option-card${item.isTreat?' treat-card':''}" data-id="${escAttr(item.id)}" data-name="${escAttr(item.name)}" data-emoji="${escAttr(item.emoji||'🍽️')}" data-kcal="${item.kcal||0}" data-protein="${item.protein||0}" data-carbs="${item.carbs||0}" data-fat="${item.fat||0}" data-fiber="${item.fiber||0}" data-iron="${item.iron||0}" data-vitc="${item.vitC||0}" data-b12="${item.b12||0}" data-treat="${item.isTreat||false}">
    <div class="option-selected-check">✓</div>
    <span class="option-emoji">${item.emoji||'🍽️'}</span>
    <span class="option-name">${escHtml(item.name)}</span>
    <span class="option-kcal">${item.kcal||0} kcal</span>
    ${tagHtml}
    ${item.note ? `<span class="option-note">${escHtml(item.note)}</span>` : ''}
  </div>`;
}

function buildTagPills(tags) {
  const tagMap = { iron:'iron', b12:'b12', vitaminc:'light', veg:'veg', light:'light', tangy:'fave', 'south-indian':'fave', protein:'light', fiber:'veg' };
  return `<div class="option-tags">${(tags||[]).slice(0,2).map(t=>`<span class="option-tag tag-${tagMap[t]||'light'}">${t}</span>`).join('')}</div>`;
}

function toggleFoodSelection(card) {
  const id    = card.dataset.id;
  const name  = card.dataset.name;
  const emoji = card.dataset.emoji;
  const kcal  = parseInt(card.dataset.kcal) || 0;
  const treat = card.dataset.treat === 'true';
  const protein = parseFloat(card.dataset.protein) || 0;
  const carbs = parseFloat(card.dataset.carbs) || 0;
  const fat   = parseFloat(card.dataset.fat) || 0;
  const fiber = parseFloat(card.dataset.fiber) || 0;
  const iron  = parseFloat(card.dataset.iron) || 0;
  const vitC  = parseFloat(card.dataset.vitc) || 0;
  const b12   = parseFloat(card.dataset.b12) || 0;

  const idx = state.pendingSelections.findIndex(s => s.id===id);
  if (idx >= 0) {
    state.pendingSelections.splice(idx, 1);
    card.classList.remove('selected');
  } else {
    state.pendingSelections.push({ id, name, emoji, kcal, isTreat:treat, protein, carbs, fat, fiber, iron, vitC, b12 });
    card.classList.add('selected');
  }
  updateSelectionBar();
}

function updateSelectionBar() {
  const count = state.pendingSelections.length;
  const total = state.pendingSelections.reduce((s,i)=>s+i.kcal, 0);
  const limit = MEAL_WINDOWS[state.activeTapSlot]?.kcalLimit || 500;
  if (count > 0) {
    selectionBar.classList.remove('hidden');
    selCount.textContent = `${count} item${count>1?'s':''}`;
    selKcal.textContent  = `${total} kcal`;
    // Color code: green if under limit, amber if near, red if over
    if (total > limit * 1.2) selKcal.style.color = '#B71C1C';
    else if (total > limit) selKcal.style.color = '#FF8F00';
    else selKcal.style.color = 'var(--success)';
    logSelectionBtn.disabled = false;
  } else {
    selectionBar.classList.add('hidden');
    logSelectionBtn.disabled = true;
  }
}

// ── LOG MEAL ───────────────────────────────────────────────
async function logMealSelection() {
  const slot  = state.activeTapSlot;
  const items = [...state.pendingSelections];
  if (!items.length || !slot) return;

  const totalKcal = items.reduce((s,i)=>s+i.kcal, 0);
  const totalProtein = items.reduce((s,i)=>s+(i.protein||0), 0);
  const totalIron = items.reduce((s,i)=>s+(i.iron||0), 0);
  const totalVitC = items.reduce((s,i)=>s+(i.vitC||0), 0);
  const totalB12 = items.reduce((s,i)=>s+(i.b12||0), 0);
  const totalFiber = items.reduce((s,i)=>s+(i.fiber||0), 0);

  const entry = {
    items, totalKcal, totalProtein, totalIron, totalVitC, totalB12, totalFiber,
    loggedAt: new Date().toISOString(), slot
  };

  if (!state.todayLog) state.todayLog = {};
  state.todayLog[slot] = entry;
  state.todayLog.updatedAt = new Date().toISOString();

  // Save recently logged
  saveRecentlyLogged(items);

  // Save to Firestore
  try {
    if (state.user) {
      const update = {};
      update[slot] = {
        items: items.map(i => ({ id:i.id, name:i.name, emoji:i.emoji, kcal:i.kcal,
          protein:i.protein||0, carbs:i.carbs||0, fat:i.fat||0, fiber:i.fiber||0,
          iron:i.iron||0, vitC:i.vitC||0, b12:i.b12||0, isTreat:i.isTreat||false })),
        totalKcal, totalProtein, totalIron, totalVitC, totalB12, totalFiber,
        loggedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      // Recalculate day totals
      let dayKcal=totalKcal, dayProtein=totalProtein, dayIron=totalIron, dayVitC=totalVitC, dayB12=totalB12, dayFiber=totalFiber;
      Object.keys(MEAL_WINDOWS).forEach(k => {
        if (k !== slot && state.todayLog[k]?.totalKcal) {
          dayKcal += state.todayLog[k].totalKcal;
          dayProtein += state.todayLog[k].totalProtein || 0;
          dayIron += state.todayLog[k].totalIron || 0;
          dayVitC += state.todayLog[k].totalVitC || 0;
          dayB12 += state.todayLog[k].totalB12 || 0;
          dayFiber += state.todayLog[k].totalFiber || 0;
        }
      });
      update.dayTotalKcal = dayKcal;
      update.dayTotalProtein = dayProtein;
      update.dayTotalIron = dayIron;
      update.dayTotalVitC = dayVitC;
      update.dayTotalB12 = dayB12;
      update.dayTotalFiber = dayFiber;
      update.date = todayStr();
      update.userEmail = state.user.email;
      await db.collection('meal_logs').doc(todayStr()).set(update, { merge: true });
    }
  } catch(e) {
    console.warn('Firestore save failed, saving locally:', e.message);
    saveLocalLog(state.todayLog);
  }

  closeMealTapModalFn();
  const isFast = isFastDayDate(new Date());
  renderHero(isFast);
  renderTimeline(isFast);
  renderFoodLogSection();
  renderNutritionChart();
  renderMissedMealBanner();
  showCelebration(items.some(i=>i.isTreat));
}

// ── FOOD LOG SECTION ───────────────────────────────────────
function renderFoodLogSection() {
  const log = state.todayLog || {};
  let totalKcal = 0;
  const entries = [];

  Object.keys(MEAL_WINDOWS).forEach(slot => {
    const entry = log[slot];
    if (entry?.items?.length) {
      entry.items.forEach(item => {
        entries.push({ ...item, slot, time: entry.loggedAt });
        totalKcal += item.kcal;
      });
    }
  });

  if (entries.length === 0) {
    logEntriesList.innerHTML = `<div class="log-empty-state">
      <img src="bubu.gif" class="log-empty-gif" alt="Bubu" />
      <p>No meals logged yet!</p>
      <small>Tap a meal card to log what you ate 👇</small>
    </div>`;
  } else {
    logEntriesList.innerHTML = entries.map(e => `
      <div class="log-entry">
        <span class="log-entry-emoji">${e.emoji||'🍽️'}</span>
        <div class="log-entry-info">
          <span class="log-entry-name">${escHtml(e.name)}</span>
          <span class="log-entry-meta">${MEAL_WINDOWS[e.slot]?.label||e.slot}</span>
        </div>
        <span class="log-entry-kcal">${e.kcal} kcal</span>
      </div>
    `).join('') + `<div class="log-total-row">
      <span class="log-total-label">Total today:</span>
      <span class="log-total-kcal">${totalKcal} kcal</span>
    </div>`;
  }

  updateCalorieRing(totalKcal);
}

function updateCalorieRing(consumed) {
  const circ = 2 * Math.PI * 52;
  const pct  = Math.min(consumed / CALORIE_TARGET, 1);
  const offset = circ * (1 - pct);
  calorieCircle.style.strokeDashoffset = offset;
  const col = consumed < 800 ? '#4CAF50' : consumed < CALORIE_TARGET ? '#FF8F00' : '#D84315';
  calorieCircle.style.stroke = col;
  caloriesConsumed.textContent  = consumed;
  const left = Math.max(0, CALORIE_TARGET - consumed);
  caloriesRemaining.textContent = left > 0 ? `${left} left` : '✅ Goal!';
}

// ── NUTRITION CHART ────────────────────────────────────────
function renderNutritionChart() {
  const log = state.todayLog || {};
  let protein=0, iron=0, vitC=0, b12=0, fiber=0;

  Object.keys(MEAL_WINDOWS).forEach(slot => {
    const entry = log[slot];
    if (entry?.items?.length) {
      entry.items.forEach(item => {
        protein += item.protein || 0;
        iron += item.iron || 0;
        vitC += item.vitC || 0;
        b12 += item.b12 || 0;
        fiber += item.fiber || 0;
      });
    }
  });

  // Daily targets for a 36F wanting weight loss + iron/B12 deficiency
  const targets = { protein: 55, iron: 18, vitC: 80, b12: 2.4, fiber: 25 };

  setNutrientBar(nutriProteinBar, nutriProteinVal, protein, targets.protein, 'g');
  setNutrientBar(nutriIronBar, nutriIronVal, iron, targets.iron, 'mg');
  setNutrientBar(nutriVitCBar, nutriVitCVal, vitC, targets.vitC, 'mg');
  setNutrientBar(nutriB12Bar, nutriB12Val, b12, targets.b12, 'mcg');
  setNutrientBar(nutriFiberBar, nutriFiberVal, fiber, targets.fiber, 'g');
}

function setNutrientBar(barEl, valEl, current, target, unit) {
  if (!barEl || !valEl) return;
  const pct = Math.min(100, (current / target) * 100);
  barEl.style.width = `${pct}%`;
  valEl.textContent = `${current.toFixed(1)}${unit} / ${target}${unit}`;
  // Color
  if (pct >= 80) barEl.style.background = 'var(--success)';
  else if (pct >= 50) barEl.style.background = 'var(--secondary)';
  else barEl.style.background = 'var(--primary)';
}

// ── TIMELINE ───────────────────────────────────────────────
function renderTimeline(isFast) {
  const slots = Object.keys(MEAL_WINDOWS);
  const mins  = minsNow();
  const { meal: activeSlot } = getCurrentMealInfo();

  mealTimeline.innerHTML = slots.map((key, i) => {
    const win     = MEAL_WINDOWS[key];
    const logEntry= state.todayLog?.[key];
    const isLogged= logEntry?.items?.length > 0;
    const isActive= key === activeSlot;
    const isPast  = mins > win.end;
    const cardCls = `timeline-card${isActive?' active-meal':''}${isLogged?' eaten-meal':''}`;

    const loggedItemsHtml = isLogged
      ? `<div class="tcard-logged-items">${logEntry.items.slice(0,3).map(it=>`<div class="tcard-logged-item">${it.emoji||'✅'} ${escHtml(it.name)}</div>`).join('')}</div>`
      : `<div class="tcard-item tcard-empty">Tap to log your meal</div>`;

    const kcalInfo = isLogged ? `<div class="tcard-kcal-info">${logEntry.totalKcal} / ${win.kcalLimit} kcal</div>` : `<div class="tcard-kcal-info tcard-kcal-target">Target: ~${win.kcalLimit} kcal</div>`;

    const status = isLogged ? '✅ Logged!' : isPast ? '⚠️ Missed?' : isActive ? '🍽️ Now!' : '⏳ Upcoming';
    const stCls  = isLogged ? 'done' : isPast ? 'missed' : 'pend';

    const fastPP = isFast && key==='snack' ? `<div class="fast-badge-card"><img src="bubu eating pani puri.png" alt="Pani Puri"/><span>Pani Puri day! 🥄</span></div>` : '';

    return `<div class="${cardCls}" style="animation-delay:${0.08*i}s" onclick="openMealTapModal('${key}',${isFast})">
      <img src="${MEAL_IMAGES[key]}" class="tcard-img" alt="${win.label}" loading="lazy"/>
      <div class="tcard-body">
        <div class="tcard-meal">${win.emoji} ${win.label}</div>
        <div class="tcard-time">${win.time}</div>
        ${loggedItemsHtml}
        ${kcalInfo}
        <div class="tcard-status ${stCls}">${status}</div>
      </div>
      ${fastPP}
      <button class="tcard-log-btn">${isLogged?'✏️ Edit':'+ Log Meal'}</button>
    </div>`;
  }).join('');
}

// ── FAST BADGE ─────────────────────────────────────────────
function renderFastBadge(isFast) {
  if (isFast) fastDayBadge.classList.remove('hidden');
  else        fastDayBadge.classList.add('hidden');
}

// ── WEIGHT TRACKER ─────────────────────────────────────────
function renderWeightTracker() {
  const cur  = state.currentWeight;
  const tar  = state.targetWeight;
  const pct  = Math.min(100, Math.max(0, ((65-cur)/(65-tar))*100));
  currentWeightDisp.textContent = `${cur} kg`;
  weightProgressFill.style.width = `${pct}%`;
  progressText.textContent = `${pct.toFixed(1)}% there!`;
  const lost = (65-cur).toFixed(1);
  const left = (cur-tar).toFixed(1);
  if (pct>=100) weightNote.textContent = `🎉 TARGET REACHED! Amazing Bubu! Dudu is so proud!`;
  else if (lost>0) weightNote.textContent = `You've lost ${lost} kg! ${left} kg to go — keep going Bubu! 💪`;
  else weightNote.textContent = `Every healthy meal brings you closer to 55 kg! You can do it! 💪`;
}

async function saveWeight() {
  const val = parseFloat(weightInput.value);
  if (isNaN(val)||val<40||val>130) { alert('Please enter a valid weight!'); return; }
  try {
    await db.collection('settings').doc('weight').set({ current:val, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    await db.collection('weight_log').doc(todayStr()).set({ weight:val, date:todayStr() });
    state.currentWeight = val;
    renderWeightTracker();
    weightInput.value = '';
    if (val < 65) showCelebration(false);
  } catch(e) { alert('Could not save weight: '+e.message); }
}

// ── HISTORY ────────────────────────────────────────────────
async function loadHistory() {
  const historyList = $('history-list');
  if (!historyList) return;

  const days = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    days.push({ date: key, display: d.toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric' }) });
  }

  let html = '';
  for (const day of days) {
    try {
      const doc = await db.collection('meal_logs').doc(day.date).get();
      if (doc.exists) {
        const data = doc.data();
        const kcal = data.dayTotalKcal || 0;
        const slots = Object.keys(MEAL_WINDOWS).filter(k => data[k]?.items?.length).length;
        const pct = Math.min(100, (kcal / CALORIE_TARGET) * 100);
        html += `<div class="history-row">
          <div class="history-date">${day.display}</div>
          <div class="history-bar-wrap"><div class="history-bar-fill" style="width:${pct}%"></div></div>
          <div class="history-stats">${kcal} kcal · ${slots}/5 meals</div>
        </div>`;
      } else {
        html += `<div class="history-row history-empty">
          <div class="history-date">${day.display}</div>
          <div class="history-stats">No data</div>
        </div>`;
      }
    } catch(e) {
      html += `<div class="history-row history-empty">
        <div class="history-date">${day.display}</div>
        <div class="history-stats">—</div>
      </div>`;
    }
  }
  historyList.innerHTML = html || '<p style="text-align:center;color:var(--text-light)">No history yet</p>';
}

// ── FOOTER ─────────────────────────────────────────────────
function renderFooter() {
  const h = new Date().getHours();
  if (h<10)      footerMsg.textContent = "Good morning Bubu! Eat your iron-rich breakfast 🌅";
  else if (h<12) footerMsg.textContent = "Coffee break time! Stay hydrated ☕";
  else if (h<15) footerMsg.textContent = "Lunch time! Dudu is thinking of you 💕";
  else if (h<19) footerMsg.textContent = "Snack time! Something light & healthy 🍎";
  else if (h<22) footerMsg.textContent = "Dinner time! Light & healthy 🌙";
  else           footerMsg.textContent = "Great day Bubu! Take your Magnesium + D3 before sleeping 💕";
}

// ── SUPPLEMENT STRIP ───────────────────────────────────────
function initSupplementStrip() {
  renderSupplementPills();
  setInterval(renderSupplementPills, 5*60*1000);
  setInterval(checkSupplementReminders, 10*60*1000);
}

function renderSupplementPills() {
  SUPPLEMENTS.forEach(supp => {
    const takenKey = `supp_${todayStr()}_${supp.id}`;
    const taken = !!localStorage.getItem(takenKey);
    const btn = $(`supp-btn-${supp.id}`);
    const tag = $(`supp-tag-${supp.id}`);
    if (!btn || !tag) return;
    if (taken) { btn.classList.add('taken'); tag.textContent = '✅'; }
    else { btn.classList.remove('taken'); tag.textContent = 'Take'; }
  });
}

function openSupplementModal(suppId) {
  const supp = SUPPLEMENTS.find(s=>s.id===suppId);
  if (!supp) return;
  state.activeSuppId = suppId;
  suppModalIcon.textContent     = supp.icon;
  suppModalTitle.textContent    = supp.label;
  suppModalSubtitle.textContent = `${supp.timeLabel} · ${supp.time}`;
  suppModalNote.textContent     = supp.note;

  const takenKey  = `supp_${todayStr()}_${suppId}`;
  const takenTime = localStorage.getItem(takenKey);
  if (takenTime) {
    suppNotTakenArea.classList.add('hidden');
    suppTakenArea.classList.remove('hidden');
    suppTakenTimeLabel.textContent = `Taken at ${new Date(parseInt(takenTime)).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;
  } else {
    suppNotTakenArea.classList.remove('hidden');
    suppTakenArea.classList.add('hidden');
  }
  supplementModal.classList.remove('hidden');
}

function confirmSupplementTaken(suppId) {
  const takenKey = `supp_${todayStr()}_${suppId}`;
  localStorage.setItem(takenKey, Date.now());
  renderSupplementPills();
  supplementModal.classList.add('hidden');
  const supp = SUPPLEMENTS.find(s=>s.id===suppId);
  if (supp) {
    celebrationMsg.textContent = `${supp.icon} ${supp.label} marked as taken! Great Bubu! 💪`;
    celebrationOverlay.classList.remove('hidden');
    confettiContainer.innerHTML = '';
    spawnMiniConfetti(20);
  }
}

function checkSupplementReminders() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  SUPPLEMENTS.forEach(supp => {
    const takenKey = `supp_${todayStr()}_${supp.id}`;
    const taken = !!localStorage.getItem(takenKey);
    if (!taken && h === supp.triggerH && m >= supp.triggerM) {
      warningMsg.textContent = `${supp.icon} Bubu! Time to take your ${supp.label}! (${supp.time})`;
      warningOverlay.classList.remove('hidden');
    }
  });
}

// ── FOOD SEARCH ────────────────────────────────────────────
function openFoodSearchModal() {
  foodSearchModal.classList.remove('hidden');
  foodSearchInput.value = '';
  manualFoodName.value = '';
  manualFoodKcal.value = '';
  searchResultsList.innerHTML = '';
  searchEmptyMsg.classList.add('hidden');
  searchSpinner.classList.add('hidden');
  renderLocalResults('');
  setTimeout(() => foodSearchInput.focus(), 100);
}

function renderLocalResults(query) {
  const q = query.toLowerCase().trim();
  // Search both INDIAN_FOODS_DB and all canteen items
  const allSearchable = [...INDIAN_FOODS_DB, ...getAllCanteenItems()];
  const results = q
    ? allSearchable.filter(f => f.name.toLowerCase().includes(q)).slice(0, 20)
    : INDIAN_FOODS_DB.slice(0, 12);

  searchResultsList.innerHTML = results.map(f => buildSearchResultItem(f)).join('');
  if (q && results.length===0) searchEmptyMsg.classList.remove('hidden');
  else searchEmptyMsg.classList.add('hidden');
}

function buildSearchResultItem(f) {
  return `<div class="search-result-item" data-name="${escAttr(f.name)}" data-emoji="${escAttr(f.emoji||'🍽️')}" data-kcal="${f.kcal||0}" data-protein="${f.protein||0}" data-carbs="${f.carbs||0}" data-fat="${f.fat||0}" data-fiber="${f.fiber||0}" data-iron="${f.iron||0}" data-vitc="${f.vitC||0}" data-b12="${f.b12||0}">
    <span class="result-emoji">${f.emoji||'🍽️'}</span>
    <div class="result-info">
      <span class="result-name">${escHtml(f.name)}</span>
      ${f.brand ? `<span class="result-brand">${escHtml(f.brand)}</span>` : ''}
    </div>
    <span class="result-kcal">${f.kcal||0} kcal</span>
  </div>`;
}

async function searchOpenFoodFacts(query) {
  if (!query.trim()) return;
  searchSpinner.classList.remove('hidden');
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments,image_url`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const prods = (data.products || []).filter(p => p.product_name);
    const mapped = prods.map(p => ({
      name: p.product_name, brand: p.brands || '', emoji: '🔍',
      kcal: Math.round(p.nutriments?.['energy-kcal_100g'] || p.nutriments?.energy_100g/4.184 || 0),
      protein: Math.round(p.nutriments?.proteins_100g || 0),
      carbs: Math.round(p.nutriments?.carbohydrates_100g || 0),
      fat: Math.round(p.nutriments?.fat_100g || 0),
      fiber: Math.round(p.nutriments?.fiber_100g || 0),
      iron: 0, vitC: 0, b12: 0,
    }));
    searchResultsList.innerHTML = mapped.map(f => buildSearchResultItem(f)).join('') ||
      `<div class="search-empty">No results from Open Food Facts.</div>`;
  } catch(e) {
    searchResultsList.innerHTML = `<div class="search-empty">Could not reach food database.</div>`;
  }
  searchSpinner.classList.add('hidden');
}

function addFoodFromSearch(el) {
  const item = {
    id: 'search_'+Date.now(), name: el.dataset.name, emoji: el.dataset.emoji||'🍽️',
    kcal: parseInt(el.dataset.kcal)||0, isTreat:false,
    protein: parseFloat(el.dataset.protein)||0, carbs: parseFloat(el.dataset.carbs)||0,
    fat: parseFloat(el.dataset.fat)||0, fiber: parseFloat(el.dataset.fiber)||0,
    iron: parseFloat(el.dataset.iron)||0, vitC: parseFloat(el.dataset.vitc)||0,
    b12: parseFloat(el.dataset.b12)||0,
  };
  state.pendingSelections.push(item);
  closeFoodSearchModalFn();
  updateSelectionBar();
}

function addManualFood() {
  const name = manualFoodName.value.trim();
  const kcal = parseInt(manualFoodKcal.value) || 0;
  if (!name) { manualFoodName.style.borderColor='var(--primary)'; return; }
  state.pendingSelections.push({
    id:'manual_'+Date.now(), name, emoji:'🍽️', kcal, isTreat:false,
    protein:0, carbs:0, fat:0, fiber:0, iron:0, vitC:0, b12:0,
  });
  closeFoodSearchModalFn();
  updateSelectionBar();
  manualFoodName.value = '';
  manualFoodKcal.value = '';
}

// ── CELEBRATION ────────────────────────────────────────────
function showCelebration(isTreat=false) {
  if (isTreat) {
    celebrationMsg.textContent = "Treat time! 🎉 Enjoy it Bubu — you deserve it! Dudu loves you 💕";
  } else {
    celebrationMsg.textContent = CELEBRATION_MSGS[Math.floor(Math.random()*CELEBRATION_MSGS.length)];
  }
  confettiContainer.innerHTML = '';
  spawnMiniConfetti(60);
  celebrationOverlay.classList.remove('hidden');
}

function spawnMiniConfetti(count) {
  const colors = ['#E8472A','#F57F17','#4CAF50','#E91E63','#3F51B5','#FFD600'];
  for (let i=0; i<count; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.left = `${Math.random()*100}%`;
    c.style.top  = `${-20 - Math.random()*40}px`;
    c.style.background = colors[Math.floor(Math.random()*colors.length)];
    c.style.animationDuration  = `${1.5+Math.random()*2}s`;
    c.style.animationDelay     = `${Math.random()*0.8}s`;
    c.style.width  = `${6+Math.random()*8}px`;
    c.style.height = `${6+Math.random()*8}px`;
    c.style.borderRadius = Math.random()>0.5?'50%':'2px';
    confettiContainer.appendChild(c);
  }
}

// ── EMAIL REMINDERS ────────────────────────────────────────
function initEmailReminders() {
  if (typeof emailjs === 'undefined') return;
  if (EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') return;
  emailjs.init(EMAILJS_CONFIG.publicKey);
}

function scheduleReminderChecks() {
  Object.entries(MEAL_WINDOWS).forEach(([slot, win]) => {
    const now   = minsNow();
    const delay = win.start + EMAILJS_CONFIG.reminderDelayMins - now;
    if (delay > 0) {
      setTimeout(() => checkAndSendReminder(slot), delay * 60 * 1000);
    }
  });
  setTimeout(inAppMealWarning, 60*60*1000);
}

function checkAndSendReminder(slot) {
  const log = state.todayLog?.[slot];
  if (log?.items?.length) return;
  const sentKey = `email_sent_${todayStr()}_${slot}`;
  if (localStorage.getItem(sentKey)) return;
  sendMealReminderEmail(slot);
}

async function sendMealReminderEmail(slot) {
  if (typeof emailjs==='undefined' || EMAILJS_CONFIG.publicKey==='YOUR_PUBLIC_KEY') return;
  const win = MEAL_WINDOWS[slot];
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
      to_email:   EMAILJS_CONFIG.recipientEmail,
      bubu_name:  state.realName || 'Bubu',
      meal_name:  win.label,
      meal_time:  win.time,
      message:    `Hi Bubu! 🍽️ You haven't logged your ${win.label} yet (${win.time}). Don't forget to eat and log your meal! — Dudu 💕`,
    });
    localStorage.setItem(`email_sent_${todayStr()}_${slot}`, '1');
  } catch(e) { console.warn('Email reminder failed:', e); }
}

function inAppMealWarning() {
  const { meal } = getCurrentMealInfo();
  if (!meal) return;
  const log = state.todayLog?.[meal];
  if (!log?.items?.length) {
    warningMsg.textContent = `Bubu! It's ${MEAL_WINDOWS[meal].label} time and you haven't logged anything! Dudu is watching 👀`;
    warningOverlay.classList.remove('hidden');
  }
  setTimeout(inAppMealWarning, 60*60*1000);
}

// ── CURRENT MEAL HELPER ────────────────────────────────────
function getCurrentMealInfo() {
  const mins = minsNow();
  let meal = null, next = null;
  for (const [key, win] of Object.entries(MEAL_WINDOWS)) {
    if (mins >= win.start && mins <= win.end) { meal = key; break; }
  }
  if (!meal) {
    for (const [key, win] of Object.entries(MEAL_WINDOWS)) {
      if (mins < win.start) { next = key; break; }
    }
  }
  return { meal, next };
}

// ── ADMIN PANEL ────────────────────────────────────────────
function openAdminPanel() {
  adminDateInput.value = todayStr();
  loadAdminPlan(todayStr());
  adminOverlay.classList.remove('hidden');
  adminPanel.classList.remove('hidden');
  setTimeout(() => adminPanel.classList.add('open'), 10);
}
function closeAdminPanelFn() {
  adminPanel.classList.remove('open');
  setTimeout(() => { adminPanel.classList.add('hidden'); adminOverlay.classList.add('hidden'); }, 380);
}

async function loadAdminPlan(dateKey) {
  try {
    const doc = await db.collection('diet_plans').doc(dateKey).get();
    if (doc.exists) {
      const data = doc.data();
      fastDayToggle.checked = data.isFastDay || false;
      adminDayNotes.value   = data.notes || '';
      state.adminData       = JSON.parse(JSON.stringify(data.meals || {}));
    } else {
      fastDayToggle.checked = isFastDayDate(new Date(dateKey+'T00:00:00'));
      adminDayNotes.value   = '';
      state.adminData = { morning:{items:[]}, coffee:{items:[]}, lunch:{items:[]}, snack:{items:[]}, dinner:{items:[]} };
    }
  } catch(e) {
    state.adminData = { morning:{items:[]}, coffee:{items:[]}, lunch:{items:[]}, snack:{items:[]}, dinner:{items:[]} };
  }
  ['morning','coffee','lunch','snack','dinner'].forEach(m => renderMealEditor(m));
}

function renderMealEditor(meal) {
  const container = $(`editor-${meal}`);
  if (!container) return;
  container.innerHTML = '';
  const items = state.adminData[meal]?.items || [];
  items.forEach((item, idx) => appendItemRow(container, meal, item, idx));
}

function appendItemRow(container, meal, item, idx) {
  const row = document.createElement('div');
  row.className = 'item-editor-row';
  row.innerHTML = `
    <div class="item-row-head">
      <input type="text" class="item-name" placeholder="Food name" value="${escAttr(item.name||'')}" />
      <button class="btn-remove-item" title="Remove">✕</button>
    </div>
    <textarea class="item-desc" placeholder="Description / notes">${escHtml(item.description||'')}</textarea>
    <div class="item-image-section">
      <img class="item-image-preview ${item.imageUrl?'visible':''}" src="${item.imageUrl||''}" alt="preview" />
      <label class="btn-upload-img">📷 Photo<input type="file" accept="image/*" class="item-file-input" style="display:none" /></label>
    </div>`;
  const nameEl = row.querySelector('.item-name');
  const descEl = row.querySelector('.item-desc');
  const fileEl = row.querySelector('.item-file-input');
  const prev   = row.querySelector('.item-image-preview');
  row.querySelector('.btn-remove-item').addEventListener('click', () => {
    state.adminData[meal].items.splice(idx,1); renderMealEditor(meal);
  });
  nameEl.addEventListener('input', () => { state.adminData[meal].items[idx].name = nameEl.value; });
  descEl.addEventListener('input', () => { state.adminData[meal].items[idx].description = descEl.value; });
  fileEl.addEventListener('change', async () => {
    const file = fileEl.files[0]; if (!file) return;
    try {
      const ref = storage.ref(`food_images/${todayStr()}/${meal}_${idx}_${Date.now()}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      state.adminData[meal].items[idx].imageUrl = url;
      prev.src = url; prev.classList.add('visible');
    } catch(e) { alert('Upload failed. Check Firebase Storage rules.'); }
  });
  container.appendChild(row);
}

function addItemToMeal(meal) {
  if (!state.adminData[meal]) state.adminData[meal] = { items: [] };
  state.adminData[meal].items.push({ name:'', description:'', imageUrl:'' });
  renderMealEditor(meal);
}

async function savePlan() {
  const dateKey = adminDateInput.value || todayStr();
  saveStatus.classList.add('hidden');
  savePlanBtn.textContent = '⏳ Saving…';
  const meals = {};
  ['morning','coffee','lunch','snack','dinner'].forEach(meal => {
    const items = (state.adminData[meal]?.items || []).filter(it => it.name.trim());
    meals[meal] = { items };
  });
  const data = {
    isFastDay: fastDayToggle.checked,
    notes: adminDayNotes.value.trim(),
    meals,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await db.collection('diet_plans').doc(dateKey).set(data, { merge:true });
    saveStatus.textContent = '✅ Plan saved!';
    saveStatus.className = 'save-status success';
    saveStatus.classList.remove('hidden');
    savePlanBtn.textContent = '💾 Save Plan';
    if (dateKey === todayStr()) {
      state.todayPlan = data;
      const isFast = data.isFastDay;
      renderHero(isFast); renderTimeline(isFast); renderFastBadge(isFast);
    }
  } catch(e) {
    saveStatus.textContent = `❌ Error: ${e.message}`;
    saveStatus.className = 'save-status error';
    saveStatus.classList.remove('hidden');
    savePlanBtn.textContent = '💾 Save Plan';
  }
  setTimeout(() => saveStatus.classList.add('hidden'), 4000);
}

// ── MODAL CLOSE HELPERS ────────────────────────────────────
function closeMealTapModalFn() { mealTapModal.classList.add('hidden'); state.pendingSelections = []; }
function closeFoodSearchModalFn() { foodSearchModal.classList.add('hidden'); }
function closeLoginModalFn() { loginModal.classList.add('hidden'); loginError.classList.add('hidden'); loginEmail.value=''; loginPassword.value=''; }

// ── UTILITIES ──────────────────────────────────────────────
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ── EVENT LISTENERS ────────────────────────────────────────
function setupEventListeners() {
  // Auth
  loginBtn.addEventListener('click', () => loginModal.classList.remove('hidden'));
  closeLoginModal.addEventListener('click', closeLoginModalFn);
  submitLoginBtn.addEventListener('click', () => login(loginEmail.value.trim(), loginPassword.value));
  loginPassword.addEventListener('keyup', e => { if(e.key==='Enter') submitLoginBtn.click(); });
  logoutBtn.addEventListener('click', logout);
  loginModal.addEventListener('click', e => { if(e.target===loginModal) closeLoginModalFn(); });

  // Admin
  adminFab.addEventListener('click', openAdminPanel);
  closeAdminBtn.addEventListener('click', closeAdminPanelFn);
  adminOverlay.addEventListener('click', closeAdminPanelFn);
  savePlanBtn.addEventListener('click', savePlan);
  saveWeightBtn.addEventListener('click', saveWeight);
  adminDateInput.addEventListener('change', () => loadAdminPlan(adminDateInput.value));
  document.getElementById('meal-editors').addEventListener('click', e => {
    if (e.target.matches('.btn-add-item')) addItemToMeal(e.target.dataset.meal);
  });

  // Meal Tap Modal
  closeMealTapBtn.addEventListener('click', closeMealTapModalFn);
  mealTapModal.addEventListener('click', e => { if(e.target===mealTapModal) closeMealTapModalFn(); });
  logSelectionBtn.addEventListener('click', logMealSelection);
  openFoodSearchBtn.addEventListener('click', openFoodSearchModal);
  heroLogBtn.addEventListener('click', () => {
    const { meal, next } = getCurrentMealInfo();
    openMealTapModal(meal || next || 'morning', isFastDayDate(new Date()));
  });
  btnLogNow.addEventListener('click', () => {
    const { meal, next } = getCurrentMealInfo();
    openMealTapModal(meal || next || 'morning', isFastDayDate(new Date()));
  });
  // Delegate option card taps inside meal tap modal
  mealTapModal.addEventListener('click', e => {
    const card = e.target.closest('.food-option-card');
    if (card) toggleFoodSelection(card);
  });

  // Toggle other canteen options
  const toggleOtherBtn = $('toggle-other-btn');
  if (toggleOtherBtn) {
    toggleOtherBtn.addEventListener('click', () => {
      const grid = $('other-options');
      if (grid) {
        grid.classList.toggle('collapsed');
        toggleOtherBtn.textContent = grid.classList.contains('collapsed') ? '▼ Show more canteen options' : '▲ Show fewer';
      }
    });
  }

  // Food Search Modal
  closeFoodSearchBtn.addEventListener('click', closeFoodSearchModalFn);
  foodSearchModal.addEventListener('click', e => { if(e.target===foodSearchModal) closeFoodSearchModalFn(); });
  foodSearchBtn.addEventListener('click', () => {
    const q = foodSearchInput.value.trim();
    renderLocalResults(q);
    if (q.length >= 3) searchOpenFoodFacts(q);
  });
  foodSearchInput.addEventListener('keyup', e => {
    renderLocalResults(foodSearchInput.value);
    if (e.key==='Enter') foodSearchBtn.click();
  });
  searchResultsList.addEventListener('click', e => {
    const item = e.target.closest('.search-result-item');
    if (item) addFoodFromSearch(item);
  });
  addManualFoodBtn.addEventListener('click', addManualFood);
  manualFoodKcal.addEventListener('keyup', e => { if(e.key==='Enter') addManualFood(); });

  // Supplement strip
  $('supp-btn-iron_b12').addEventListener('click', () => openSupplementModal('iron_b12'));
  $('supp-btn-mag_d3').addEventListener('click', () => openSupplementModal('mag_d3'));
  closeSuppModalBtn.addEventListener('click', () => supplementModal.classList.add('hidden'));
  supplementModal.addEventListener('click', e => { if(e.target===supplementModal) supplementModal.classList.add('hidden'); });
  markSuppTakenBtn.addEventListener('click', () => confirmSupplementTaken(state.activeSuppId));

  // Celebration / Warning
  closeCelebrationBtn.addEventListener('click', () => celebrationOverlay.classList.add('hidden'));
  closeWarningBtn.addEventListener('click', () => warningOverlay.classList.add('hidden'));
}
