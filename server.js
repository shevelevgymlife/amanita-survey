const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MONGODB ──
const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://shevelevgymlife:Yoyoyoyoyo-007@cluster0.9kqsnpc.mongodb.net/amanita?appName=Cluster0';
let db;

async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('amanita');
    console.log('✅ MongoDB подключена!');
  } catch (err) {
    console.error('❌ Ошибка MongoDB:', err);
  }
}

function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

// Проверить — уже голосовал?
app.get('/api/check', async (req, res) => {
  const ip = getIP(req);
  try {
    const existing = await db.collection('reviews').findOne({ ip });
    res.json({ voted: !!existing });
  } catch (err) {
    res.json({ voted: false });
  }
});

// Отправить отзыв
app.post('/api/reviews', async (req, res) => {
  try {
    const ip = getIP(req);
    const existing = await db.collection('reviews').findOne({ ip });
    if (existing) {
      return res.status(429).json({ error: 'duplicate', message: 'Вы уже оставляли отзыв. Спасибо!' });
    }

    const { gender, age_group, mushroom_type, preparation, dosage_grams, experience_type, duration_hours, effects_presence, setting, physical_effects, mental_effects, overall_rating, would_repeat, safety_concerns, review_text, prior_experience, reason, trip_state, experience_duration_unit, experience_duration_value } = req.body;

    if (!gender || !mushroom_type || !dosage_grams || !overall_rating || !experience_type) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    const review = {
      ip,
      created_at: new Date(),
      gender, age_group, mushroom_type, preparation,
      dosage_grams: parseFloat(dosage_grams),
      experience_type,
      duration_hours: duration_hours ? parseFloat(duration_hours) : null,
      effects_presence,
      setting,
      physical_effects: physical_effects || [],
      mental_effects: mental_effects || [],
      overall_rating: parseInt(overall_rating),
      would_repeat, safety_concerns,
      review_text: review_text || '',
      prior_experience,
      reason: Array.isArray(reason) ? reason : (reason ? [reason] : []),
      trip_state,
      experience_duration_unit,
      experience_duration_value: experience_duration_value ? parseInt(experience_duration_value) : null
    };

    await db.collection('reviews').insertOne(review);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Статистика
app.get('/api/stats', async (req, res) => {
  try {
    const reviews = await db.collection('reviews').find({}, { projection: { ip: 0 } }).toArray();

    const groupBy = (arr, key) => { const map = {}; arr.forEach(item => { const k = item[key] || 'unknown'; if (!map[k]) map[k] = []; map[k].push(item); }); return Object.keys(map).map(k => ({ key: k, items: map[k] })); };
    const avg = (arr, key) => arr.length ? arr.reduce((s, i) => s + (i[key] || 0), 0) / arr.length : 0;

    const byGender = groupBy(reviews, 'gender').map(g => ({ gender: g.key, count: g.items.length, avg_rating: avg(g.items, 'overall_rating') }));
    const byMushroom = groupBy(reviews, 'mushroom_type').map(g => ({ mushroom_type: g.key, count: g.items.length, avg_rating: avg(g.items, 'overall_rating'), avg_dosage: avg(g.items, 'dosage_grams') }));
    const byExperience = groupBy(reviews, 'experience_type').map(g => ({ experience_type: g.key, count: g.items.length }));

    const dosageRanges = [{ label: 'Микродоза (<1г)', fn: r => r.dosage_grams < 1 }, { label: 'Малая (1-3г)', fn: r => r.dosage_grams >= 1 && r.dosage_grams < 3 }, { label: 'Средняя (3-6г)', fn: r => r.dosage_grams >= 3 && r.dosage_grams < 6 }, { label: 'Высокая (6-10г)', fn: r => r.dosage_grams >= 6 && r.dosage_grams < 10 }, { label: 'Очень высокая (>10г)', fn: r => r.dosage_grams >= 10 }];
    const byDosage = dosageRanges.map(range => { const items = reviews.filter(range.fn); return { dosage_range: range.label, count: items.length, avg_rating: avg(items, 'overall_rating') }; }).filter(d => d.count > 0);

    const byPreparation = groupBy(reviews, 'preparation').map(g => ({ preparation: g.key, count: g.items.length, avg_rating: avg(g.items, 'overall_rating') }));

    const ratingDist = [];
    for (let i = 1; i <= 10; i++) { const count = reviews.filter(r => r.overall_rating === i).length; if (count > 0) ratingDist.push({ overall_rating: i, count }); }

    const wouldRepeat = groupBy(reviews, 'would_repeat').map(g => ({ would_repeat: g.key, count: g.items.length }));

    const reasonMap = {};
    reviews.forEach(r => {
      const reasons = Array.isArray(r.reason) ? r.reason : [];
      reasons.forEach(reason => { if (!reasonMap[reason]) reasonMap[reason] = 0; reasonMap[reason]++; });
    });
    const byReason = Object.keys(reasonMap).map(k => ({ reason: k, count: reasonMap[k] })).sort((a, b) => b.count - a.count);

    // Physical effects frequency
    const physMap = {};
    reviews.forEach(r => {
      const effects = Array.isArray(r.physical_effects) ? r.physical_effects : [];
      effects.forEach(e => { if (!physMap[e]) physMap[e] = 0; physMap[e]++; });
    });
    const byPhysical = Object.keys(physMap).map(k => ({ effect: k, count: physMap[k] })).sort((a,b) => b.count - a.count);

    // Mental effects frequency
    const mentMap = {};
    reviews.forEach(r => {
      const effects = Array.isArray(r.mental_effects) ? r.mental_effects : [];
      effects.forEach(e => { if (!mentMap[e]) mentMap[e] = 0; mentMap[e]++; });
    });
    const byMental = Object.keys(mentMap).map(k => ({ effect: k, count: mentMap[k] })).sort((a,b) => b.count - a.count);

    // Trip states
    const byTripMushroom = groupBy(reviews, 'trip_mushroom').map(g => ({ trip_mushroom: g.key, count: g.items.length }));
    const byTripDosage = groupBy(reviews, 'trip_state').map(g => ({ trip_state: g.key, count: g.items.length }));

    // Effects presence
    const byEffectsPresence = groupBy(reviews, 'effects_presence').map(g => ({ effects_presence: g.key, count: g.items.length }));

    // Would repeat
    const byWouldRepeat = groupBy(reviews, 'would_repeat').map(g => ({ would_repeat: g.key, count: g.items.length }));

    // Safety concerns
    const bySafety = groupBy(reviews, 'safety_concerns').map(g => ({ safety: g.key, count: g.items.length }));

    // Setting
    const bySetting = groupBy(reviews, 'setting').map(g => ({ setting: g.key, count: g.items.length }));

    // Prior experience
    const byPrior = groupBy(reviews, 'prior_experience').map(g => ({ prior: g.key, count: g.items.length }));

    // Duration hours
    const durRanges = [
      { label: 'До 2 часов', fn: r => r.duration_hours && r.duration_hours < 2 },
      { label: '2-4 часа', fn: r => r.duration_hours >= 2 && r.duration_hours < 4 },
      { label: '4-6 часов', fn: r => r.duration_hours >= 4 && r.duration_hours < 6 },
      { label: '6-8 часов', fn: r => r.duration_hours >= 6 && r.duration_hours < 8 },
      { label: 'Более 8 часов', fn: r => r.duration_hours >= 8 },
    ];
    const byDuration = durRanges.map(range => {
      const items = reviews.filter(range.fn);
      return { duration: range.label, count: items.length };
    }).filter(d => d.count > 0);

    // Experience duration (months/years)
    const expDurMap = {};
    reviews.forEach(r => {
      if (r.experience_duration_unit && r.experience_duration_value) {
        const key = r.experience_duration_unit === 'years' ? 'Годы' : 'Месяцы';
        if (!expDurMap[key]) expDurMap[key] = [];
        expDurMap[key].push(r.experience_duration_value);
      }
    });
    const byExpDuration = Object.keys(expDurMap).map(k => ({
      unit: k,
      avg: Math.round(expDurMap[k].reduce((s,v) => s+v, 0) / expDurMap[k].length),
      count: expDurMap[k].length
    }));

    // Age groups
    const byAge = groupBy(reviews, 'age_group').map(g => ({ age_group: g.key, count: g.items.length }));

    // Avg dosage by preparation
    const byPrepDosage = groupBy(reviews, 'preparation').map(g => ({
      preparation: g.key,
      avg_dosage: avg(g.items, 'dosage_grams'),
      count: g.items.length
    }));

    // Age vs avg rating
    const byAgeRating = groupBy(reviews, 'age_group').map(g => ({
      age_group: g.key,
      avg_rating: avg(g.items, 'overall_rating'),
      count: g.items.length
    }));

    // Gender vs experience type cross
    const genderExpCross = {};
    reviews.forEach(r => {
      const key = (r.gender || 'unknown') + '_' + (r.experience_type || 'unknown');
      if (!genderExpCross[key]) genderExpCross[key] = 0;
      genderExpCross[key]++;
    });
    const byGenderExp = Object.keys(genderExpCross).map(k => {
      const [gender, exp] = k.split('_');
      return { gender, experience_type: exp, count: genderExpCross[k] };
    });

    // Safety vs experience type
    const safetyExpCross = {};
    reviews.forEach(r => {
      const key = (r.safety_concerns || 'none') + '_' + (r.experience_type || 'unknown');
      if (!safetyExpCross[key]) safetyExpCross[key] = 0;
      safetyExpCross[key]++;
    });
    const bySafetyExp = Object.keys(safetyExpCross).map(k => {
      const [safety, exp] = k.split('_');
      return { safety, experience_type: exp, count: safetyExpCross[k] };
    });

    const recent = reviews.slice(-10).reverse().map(r => ({
      gender: r.gender, age_group: r.age_group, mushroom_type: r.mushroom_type,
      dosage_grams: r.dosage_grams, experience_type: r.experience_type,
      overall_rating: r.overall_rating, review_text: r.review_text, created_at: r.created_at
    }));

    res.json({ total: reviews.length, byGender, byMushroom, byExperience, byDosage, byPreparation, ratingDist, wouldRepeat: byWouldRepeat, byReason, byPhysical, byMental, byTripMushroom, byTripDosage, byEffectsPresence, bySafety, bySetting, byPrior, byDuration, byExpDuration, byAge, byPrepDosage, byAgeRating, byGenderExp, bySafetyExp, recent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/health', async (req, res) => {
  const count = await db.collection('reviews').countDocuments();
  res.json({ status: 'ok', reviews: count });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Сервер запущен: http://localhost:${PORT}`));
});
