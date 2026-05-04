# Handoff: KORT Landing Page

## Overview

Полностью переработанный лендинг для ERP-системы KORT. Лендинг включает:
- Интро-анимацию (zoom в экран ноутбука, GSAP) — **не трогать**
- Полноценный landing page поверх интро: Header, Hero, Модули, Как работает, Интеграции, Тарифы, Footer
- Двуязычность RU/KZ с localStorage-персистентностью
- Кнопку входа в основное приложение (`/auth/login`)

---

## О файлах в этом пакете

Файлы в этом бандле — **дизайн-референсы в HTML**, созданные как прототипы для демонстрации внешнего вида и поведения. Задача разработчика — **перенести этот дизайн в существующий Vite + TypeScript проект** (`KORT-TESTING-FRONTEND`), используя его паттерны и структуру.

**Не нужно** шипить HTML напрямую — нужно воссоздать его в `src/main.ts` (или отдельных компонентах).

---

## Fidelity

**High-fidelity** — пиксельно точные макеты с финальными цветами, типографикой, отступами и интерактивностью. Разработчик должен воссоздать UI с максимальной точностью используя существующие паттерны проекта.

---

## Дизайн-система: Mercury DS

### Цвета

| Имя | Hex | CSS-переменная | Роль |
|-----|-----|----------------|------|
| Mercury Blue | `#5266eb` | `--color-mercury-blue` | Единственный акцент — только primary CTA |
| Ghost Blue | `#cdddff` | `--color-ghost-blue` | Hover-состояния, secondary кнопки |
| Deep Space | `#171721` | `--color-deep-space` | Основной фон страницы |
| Midnight Slate | `#1e1e2a` | `--color-midnight-slate` | Фон секций |
| Graphite | `#272735` | `--color-graphite` | Hover на карточках |
| Lead | `#70707d` | `--color-lead` | Бордеры, dividers, secondary иконки |
| Starlight | `#ededf3` | `--color-starlight` | Primary текст |
| Silver | `#c3c3cc` | `--color-silver` | Secondary текст, описания |
| Pure White | `#ffffff` | `--color-pure-white` | Текст на Mercury Blue кнопках |

### Типографика

Шрифт: **Manrope** (Google Fonts) — заменитель проприетарных arcadia/arcadiaDisplay.

| Роль | Размер | Вес | Line-height |
|------|--------|-----|-------------|
| Hero subtitle | clamp(1.6rem, 3.2vw, 2.6rem) | 300 | 1.28 |
| Section title | clamp(32px, 4vw, 49px) | 300 | 1.12 |
| Module title | 21px | 500 | 1.2 |
| Body | 16px | 400 | 1.5 |
| Body small | 14px | 400 | 1.6 |
| Caption/labels | 12px | 600 | 1.5 |

### Отступы

Base unit: 4px. Секции разделены `112px` padding top/bottom.

### Радиусы

| Элемент | Значение |
|---------|---------|
| Карточки | 0px |
| Контейнеры | 4px |
| Кнопки | 32px (pill) |
| Кнопки large | 40px |
| Инпуты | 32px |

---

## Экраны / Секции

### 1. Intro Overlay (СОХРАНИТЬ БЕЗ ИЗМЕНЕНИЙ)

- Full-screen overlay поверх лендинга, `z-index: 9999`
- Фото ноутбука + видео на экране + логотип KORT
- По клику на экран ноутбука — GSAP-анимация zoom, затем плавное появление лендинга
- **Не изменять эту часть**

### 2. Header

- `position: fixed`, высота `64px`, `z-index: 100`
- Фон: `rgba(23,23,33,.76)` + `backdrop-filter: blur(24px)`
- При скролле >24px: фон `rgba(23,23,33,.96)`

**Левая часть:**
- Логотип `KORT_logo.png`, height `120px`, `margin: -28px -20px` (PNG имеет большие прозрачные поля)

**Центр:**
- Nav links: `font-size: 14px`, `font-weight: 500`, цвет `--color-silver`
- Hover: цвет `--color-starlight`, фон `rgba(237,237,243,.07)`, `border-radius: 32px`
- Пункты: Возможности, Как работает, Интеграции, Тарифы

**Правая часть:**
- Lang switcher RU/KZ — pill-форма, `border-radius: 40px`, `background: rgba(39,39,53,.8)`
  - Активный: `background: rgba(205,221,255,.16)`, цвет `--color-ghost-blue`
- Login button — pill `height: 36px`, `background: rgba(205,221,255,.14)`
  - По умолчанию: иконка человека по центру
  - При hover: иконка исчезает (opacity 0, scale 0.6), появляется текст "Войти"
  - Ведёт на `/auth/login`

### 3. Hero Section

- `min-height: 100vh`, центрированный контент
- Фон: `--surface-abyss` + тонкая сетка `rgba(112,112,125,.05)`
- Radial glow сверху: `rgba(82,102,235,.1)`

**Контент (вертикальный стек, `text-align: center`):**

1. Hero subtitle — крупный текст:
   - RU: *«Единая платформа для управления производством, складом, финансами и командой. Быстрое внедрение. Всё в одном контуре.»*
   - Анимация: каждое слово — `opacity: 0 → 1`, `translateY(10px → 0)`, stagger `45ms`
   - Слова «производством», «складом», «финансами» — синее подчёркивание `scaleX(0 → 1)` после появления
   - Анимация запускается **после завершения интро**, не сразу

2. CTA строка:
   - Primary: «Войти в систему» — `background: #5266eb`, `color: #fff`, `border-radius: 32px`, `padding: 16px 24px`
   - Secondary: «Узнать больше» — `background: rgba(205,221,255,.12)`, `border-radius: 32px`

### 4. Modules Section

- Фон: `--surface-surface` (`#1e1e2a`)
- Grid 3×2, разделён `1px` линиями цвета `rgba(112,112,125,.18)`
- Карточки: `border-radius: 0px`, `padding: 40px 32px`
- Hover: фон меняется на `#272735`

**Каждая карточка:**
- Иконка 40×40px, `border: 1px solid rgba(112,112,125,.3)`, `border-radius: 4px`
- Tag (caption uppercase) — цвет `--color-lead`
- Title (21px, weight 500) с bottom-border `1px solid rgba(112,112,125,.24)`
- Description (14px, `--color-silver`)

**Модули:** CRM, Склад, Производство, Финансы, Команда, Отчёты и BI

### 5. How It Works

- Layout: 2-column grid, gap `80px`
- Левая колонка: section-label + title + body text
- Правая колонка: 4 шага, каждый с номером (круглый border, 32px), заголовком и описанием
- Шаги разделены `1px solid rgba(112,112,125,.2)`

### 6. Integrations

- Фон: `--surface-surface`
- Grid 3×1 с 1px разделителями
- Карточки: лого-плашка 44×44px + название + описание
- Kaspi (оранжевый), WhatsApp Business (зелёный), BI (синий)

### 7. Pricing

- 3 колонки: Basic, **Advanced** (featured), Industrial
- Featured: `background: #272735` + синяя линия сверху `2px`
- Кнопки: primary `#5266eb` для featured, ghost с бордером для остальных

### 8. Footer

- Фон: `--surface-surface`
- Grid: 1.6fr + 3×1fr
- Левая: логотип + tagline
- Колонки: Продукт, Войти, Контакты
- Bottom bar: «© 2026 KORT.» + «ТОО "AB Electronic System"»

---

## Интеграция в Vite-проект (KORT-TESTING-FRONTEND)

### Структура файлов для переноса

```
src/
  landing/
    index.ts          ← точка входа лендинга
    landing.css       ← стили (из Landing Page.html)
    intro.ts          ← вся логика интро-анимации (GSAP)
    lang.ts           ← переключатель RU/KZ
    reveal.ts         ← IntersectionObserver scroll reveal
    heroAnim.ts       ← пословная анимация subtitle
    template.ts       ← HTML-шаблон лендинга (innerHTML)
```

### Шаг 1: Установить GSAP (уже есть в проекте)

```bash
pnpm add gsap
```

### Шаг 2: Заменить содержимое `src/main.ts`

Текущий `main.ts` содержит весь HTML лендинга и логику в одном файле. Нужно:

1. Разбить на модули (см. структуру выше) — или оставить в одном файле если удобнее
2. Заменить `app.innerHTML` с заглушки на новый HTML из `Landing Page.html`
3. Перенести все CSS-переменные Mercury DS в `src/style.css`
4. Перенести JS-логику (интро, lang, reveal, hero-анимация) в соответствующие файлы

### Шаг 3: Структура нового `main.ts`

```typescript
import { gsap } from 'gsap';
import './landing.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root #app was not found');

// 1. Вставить HTML лендинга
app.innerHTML = LANDING_HTML; // из template.ts

// 2. Инициализировать языковой переключатель
initLang();

// 3. Инициализировать scroll reveal
initReveal();

// 4. Инициализировать intro-анимацию
initIntro(gsap);
```

### Шаг 4: Ссылка на авторизацию

Все кнопки «Войти» ведут на `/auth/login` — это уже корректный роут в приложении согласно `src/app/router/index.tsx`:

```typescript
{ path: '/auth/login', element: <LoginPage /> }
```

Лендинг и основное приложение должны жить на разных роутах:
- `/` или `/landing` — лендинг
- `/auth/login` — авторизация (уже существует)
- `/` (после auth) — `CanvasPage` (уже существует)

**Вариант A** (рекомендуемый): Лендинг как отдельный HTML-файл (`landing/index.html`) в `/public`, деплоится рядом с основным приложением.

**Вариант B**: Добавить роут `/landing` в React-роутер, обернуть компонент `<LandingPage>` который рендерит лендинг (без React, чистый DOM через `useEffect`).

### Шаг 5: Публичные ассеты

Скопировать в `/public`:
```
public/
  KORT_logo.png       ✓ уже есть
  hero-bg.jpg         ✓ уже есть
  screen-record.mp4   ✓ уже есть
```

---

## Интерактивность

| Элемент | Поведение |
|---------|-----------|
| Экран ноутбука (интро) | Click → GSAP zoom → reveal лендинга |
| Кнопка логина | Hover: иконка → текст "Войти" (200ms ease) |
| Lang switcher | Click → смена всех `.ru`/`.kz` span, localStorage |
| Header | Scroll >24px → усиление background |
| Module cards | Hover → `background: #272735` |
| Scroll reveal | IntersectionObserver, `threshold: 0.08`, stagger по nth-child |
| Hero subtitle | `.animate` class → слова fade-up + подчёркивание ключевых слов |

---

## Ассеты

| Файл | Описание |
|------|----------|
| `KORT_logo.png` | Логотип KORT (синий, PNG с прозрачным фоном) |
| `hero-bg.jpg` | Фото ноутбука на фоне природы (для интро) |
| `screen-record.mp4` | Скринкаст интерфейса KORT (воспроизводится на экране ноутбука) |

---

## Файлы в этом пакете

| Файл | Описание |
|------|----------|
| `Landing Page.html` | Финальный дизайн-референс (hifi прототип) |
| `Landing Page v1.html` | Предыдущая версия (до Mercury DS) |
| `public/KORT_logo.png` | Логотип |
| `public/hero-bg.jpg` | Hero фото |
| `DESIGN.md` | Mercury Design System — полная документация |
| `variables.css` | CSS-переменные Mercury DS |
| `tokens.json` | Design tokens (JSON формат) |
| `README.md` | Этот файл |

---

## Контакты / заглушки для замены

- Email: `info@kort.kz` → заменить на реальный
- Телефон: `+7 700 123-45-67` → заменить на реальный
- Адрес: `Алматы, Казахстан` → уточнить
- Auth URL: `/auth/login` → проверить что соответствует деплой-домену

---

*Подготовлено: май 2026 · ТОО «AB Electronic System»*
