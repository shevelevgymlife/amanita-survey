# 🍄 Мухомор — Исследование Опыта

Анонимный сервис сбора отзывов об опыте употребления мухоморов.  
**Цель:** harm reduction — снижение вреда через сбор реальных данных.

---

## Что есть в проекте

- Форма анонимного отзыва (пол, вид гриба, дозировка, эффекты, оценка)
- Статистика с графиками (Chart.js)
- База данных SQLite (хранит все отзывы)
- REST API на Express.js

---

## Быстрый старт (локально)

```bash
# 1. Установить Node.js если нет: https://nodejs.org

# 2. Установить зависимости
npm install

# 3. Создать папку для базы данных
mkdir -p data

# 4. Запустить сервер
npm start

# 5. Открыть в браузере
# http://localhost:3000
```

---

## Деплой на Railway (бесплатно)

### Шаг 1 — GitHub
1. Зайдите на https://github.com
2. Нажмите **New repository** (зелёная кнопка)
3. Назовите: `amanita-survey`
4. Нажмите **Create repository**
5. Выполните команды которые показывает GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ВАШ_НИК/amanita-survey.git
git push -u origin main
```

### Шаг 2 — Railway
1. Зайдите на https://railway.app
2. Нажмите **Login with GitHub**
3. Нажмите **New Project**
4. Выберите **Deploy from GitHub repo**
5. Выберите `amanita-survey`
6. Railway автоматически запустит сервер!
7. Нажмите на проект → **Settings** → **Domains** → **Generate Domain**
8. Получите публичную ссылку вида `amanita-survey.railway.app`

### Шаг 3 — Постоянная база данных
Railway сбрасывает файлы при деплое. Для постоянного хранения:
1. В Railway нажмите **+ Add service** → **Database** → **SQLite** (или PostgreSQL бесплатно)
2. Или используйте Railway Volume: **Settings** → **Volumes** → добавить `/app/data`

---

## Структура файлов

```
amanita-survey/
├── server.js          # Сервер (Node.js + Express)
├── package.json       # Зависимости
├── Procfile           # Для Railway/Heroku
├── .gitignore
├── data/              # База данных SQLite (создаётся автоматически)
│   └── reviews.db
└── public/
    └── index.html     # Весь фронтенд (форма + графики)
```

---

## API эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/reviews` | Отправить отзыв |
| GET | `/api/stats` | Получить статистику |
| GET | `/api/health` | Проверка работы сервера |

---

## ⚠️ Дисклеймер

Проект является исследовательским и не пропагандирует употребление психоактивных веществ.
