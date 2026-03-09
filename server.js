const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'data', 'reviews.json');

function readDB() {
  try {
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ reviews: [], nextId: 1, usedIPs: [] }));
    }
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!data.usedIPs) data.usedIPs = [];
    return data;
  } catch (e) {
    return { reviews: [], nextId: 1, usedIPs: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

// Проверить — уже голосовал?
app.get('/api/check', (req, res) => {
  const ip = getIP(req);
  const db = readDB();
  const voted = db.usedIPs.includes(ip);
  res.json({ voted });
});

// Отправить отзыв
app.post('/api/reviews', (req, res) => {
  try {
    const ip = getIP(req);
    const db = readDB();

    // Проверка по IP
    if (db.usedIPs.includes(ip)) {
      return res.status(429).json({ error: 'duplicate', message: 'Вы уже оставляли отзыв. Спасибо!' });
    }

    const { gender, age_group, mushroom_type, preparation, dosage_grams, experience_type, duration_hours, setting, physical_effects, mental_effects, overall_rating, would_repeat, safety_concerns, review_text, prior_experience } = req.body;

    if (!gender || !mushroom_type || !dosage_grams || !overall_rating || !experience_type) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    const review = {
      id: db.nextId++,
      created_at: new Date().toISOString(),
      gender, age_group, mushroom_type, preparation,
      dosage_grams: parseFloat(dosage_grams),
      experience_type,
      duration_hours: duration_hours ? parseFloat(duration_hours) : null,
      setting,
      physical_effects: physical_effects || [],
      mental_effects: mental_effects || [],
      overall_rating: parseInt(overall_rating),
      would_repeat, safety_concerns,
      review_text: review_text || '',
      prior_experience
    };

    db.reviews.push(review);
    db.usedIPs.push(ip); // запомнить IP
    writeDB(db);

    res.json({ success: true, id: review.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Статистика
app.get('/api/stats', (req, res) => {
  try {
    const db = readDB();
    const reviews = db.reviews;
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
    const recent = reviews.slice(-10).reverse().map(r => ({ gender: r.gender, age_group: r.age_group, mushroom_type: r.mushroom_type, dosage_grams: r.dosage_grams, experience_type: r.experience_type, overall_rating: r.overall_rating, review_text: r.review_text, created_at: r.created_at }));
    res.json({ total: reviews.length, byGender, byMushroom, byExperience, byDosage, byPreparation, ratingDist, wouldRepeat, recent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/health', (req, res) => { const db = readDB(); res.json({ status: 'ok', reviews: db.reviews.length }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

app.listen(PORT, () => console.log(`✅ Сервер запущен: http://localhost:${PORT}`));
