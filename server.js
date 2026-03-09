const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new Database(path.join(__dirname, 'data', 'reviews.db'));

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    gender TEXT NOT NULL,
    age_group TEXT NOT NULL,
    mushroom_type TEXT NOT NULL,
    preparation TEXT NOT NULL,
    dosage_grams REAL NOT NULL,
    experience_type TEXT NOT NULL,
    duration_hours REAL,
    setting TEXT,
    physical_effects TEXT,
    mental_effects TEXT,
    overall_rating INTEGER NOT NULL,
    would_repeat TEXT NOT NULL,
    safety_concerns TEXT,
    review_text TEXT,
    prior_experience TEXT NOT NULL
  )
`);

// ─── ROUTES ───────────────────────────────────────────────

// Submit review
app.post('/api/reviews', (req, res) => {
  try {
    const {
      gender, age_group, mushroom_type, preparation,
      dosage_grams, experience_type, duration_hours,
      setting, physical_effects, mental_effects,
      overall_rating, would_repeat, safety_concerns,
      review_text, prior_experience
    } = req.body;

    // Validation
    if (!gender || !mushroom_type || !dosage_grams || !overall_rating) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    const stmt = db.prepare(`
      INSERT INTO reviews (
        gender, age_group, mushroom_type, preparation,
        dosage_grams, experience_type, duration_hours,
        setting, physical_effects, mental_effects,
        overall_rating, would_repeat, safety_concerns,
        review_text, prior_experience
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      gender, age_group, mushroom_type, preparation,
      dosage_grams, experience_type, duration_hours,
      setting,
      JSON.stringify(physical_effects || []),
      JSON.stringify(mental_effects || []),
      overall_rating, would_repeat, safety_concerns,
      review_text, prior_experience
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM reviews').get();

    // By gender
    const byGender = db.prepare(`
      SELECT gender, COUNT(*) as count, AVG(overall_rating) as avg_rating
      FROM reviews GROUP BY gender
    `).all();

    // By mushroom type
    const byMushroom = db.prepare(`
      SELECT mushroom_type, COUNT(*) as count, AVG(overall_rating) as avg_rating,
             AVG(dosage_grams) as avg_dosage
      FROM reviews GROUP BY mushroom_type
    `).all();

    // By experience type (good/bad)
    const byExperience = db.prepare(`
      SELECT experience_type, COUNT(*) as count
      FROM reviews GROUP BY experience_type
    `).all();

    // By dosage ranges
    const byDosage = db.prepare(`
      SELECT 
        CASE 
          WHEN dosage_grams < 1 THEN 'Микродоза (<1г)'
          WHEN dosage_grams < 3 THEN 'Малая (1-3г)'
          WHEN dosage_grams < 6 THEN 'Средняя (3-6г)'
          WHEN dosage_grams < 10 THEN 'Высокая (6-10г)'
          ELSE 'Очень высокая (>10г)'
        END as dosage_range,
        COUNT(*) as count,
        AVG(overall_rating) as avg_rating
      FROM reviews GROUP BY dosage_range
    `).all();

    // By preparation method
    const byPreparation = db.prepare(`
      SELECT preparation, COUNT(*) as count, AVG(overall_rating) as avg_rating
      FROM reviews GROUP BY preparation
    `).all();

    // Rating distribution
    const ratingDist = db.prepare(`
      SELECT overall_rating, COUNT(*) as count
      FROM reviews GROUP BY overall_rating ORDER BY overall_rating
    `).all();

    // Would repeat
    const wouldRepeat = db.prepare(`
      SELECT would_repeat, COUNT(*) as count
      FROM reviews GROUP BY would_repeat
    `).all();

    // Recent reviews (last 10, anonymized)
    const recent = db.prepare(`
      SELECT gender, age_group, mushroom_type, dosage_grams, 
             experience_type, overall_rating, review_text, created_at
      FROM reviews ORDER BY created_at DESC LIMIT 10
    `).all();

    res.json({
      total: total.count,
      byGender,
      byMushroom,
      byExperience,
      byDosage,
      byPreparation,
      ratingDist,
      wouldRepeat,
      recent
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', reviews: db.prepare('SELECT COUNT(*) as c FROM reviews').get().c });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});
