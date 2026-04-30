# Plan: Цех — исправление пустых карточек (CSS layout bug)

## Context

Редизайн Цех реализован (ChapanProduction.tsx, WorkshopTaskCard.tsx, workshopSort.ts, ChapanProduction.module.css). Данные грузятся (87 позиций), TypeScript 0 ошибок, сборка OK, E2E структурные тесты 11/11. Но в браузере карточки отображаются как **пустые серые прямоугольники** — контент внутри невидим.

Исходный визуал: `handoff/Производство v3 - Blue Edition.html`

---

## Диагноз: три ошибки в ChapanProduction.module.css

### Ошибка 1 — двойной scroll-контейнер

ChapanShell уже создаёт scroll-контейнер:
```css
/* ChapanShell.module.css */
.main { flex: 1; height: calc(100dvh - 50px); overflow-y: auto; }
```

Текущий `.root` создаёт второй:
```css
.root { height: 100%; overflow: hidden; }   /* ← clips content */
.cardList { flex: 1; overflow-y: auto; }    /* ← inner scroll (unnecessary) */
```

`overflow: hidden` обрывает `position: sticky` у дочерних элементов — sticky работает только внутри scrolling ancestor.

### Ошибка 2 — align-items: center скрывает контент

```css
.card {
  display: grid;
  grid-template-rows: 42px auto;
  align-items: center;   /* ← ячейки shrink до размера контента, не растягиваются */
  overflow: hidden;      /* ← clips любой выступающий контент */
}
```

Ячейки (`.cell`) не получают явную высоту 42px. Если flex-контент внутри по какой-то причине имеет высоту 0 — `overflow: hidden` скрывает его.

### Ошибка 3 — sticky offset tableHeader

```css
.tableHeader { position: sticky; top: 57px; }
```

Если sticky теперь работает относительно `.main` (не `.root`), `top: 57px` — правильный offset. Но `.pageHeader { top: 0 }` тоже правильный. Нужно проверить после фикса ошибок 1 и 2.

---

## Файл для правки

**`src/pages/workzone/chapan/production/ChapanProduction.module.css`**

---

## Точные правки

### 1. `.root` — убрать height и overflow

```css
/* БЫЛО */
.root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--ch-surface);
}

/* СТАЛО */
.root {
  display: flex;
  flex-direction: column;
  background: var(--ch-surface);
}
```

### 2. `.cardList` — убрать внутренний scroll

```css
/* БЫЛО */
.cardList {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

/* СТАЛО */
.cardList {
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

### 3. `.card` — убрать align-items: center, добавить explicit row alignment

```css
/* БЫЛО */
.card {
  display: grid;
  grid-template-columns: 44px 32px 64px 1fr 60px 140px 160px 60px 64px 80px 80px 90px;
  grid-template-rows: 42px auto;
  align-items: center;
  ...
  overflow: hidden;
}

/* СТАЛО */
.card {
  display: grid;
  grid-template-columns: 44px 32px 64px 1fr 60px 140px 160px 60px 64px 80px 80px 90px;
  grid-template-rows: 42px auto;
  align-items: stretch;   /* cells fill the 42px row */
  ...
  overflow: hidden;
}
```

### 4. `.cell` — добавить явную высоту 42px

```css
/* БЫЛО */
.cell {
  display: flex;
  align-items: center;
  padding: 0 6px;
  min-width: 0;
  overflow: hidden;
  grid-row: 1;
}

/* СТАЛО */
.cell {
  display: flex;
  align-items: center;
  height: 42px;
  padding: 0 6px;
  min-width: 0;
  overflow: hidden;
  grid-row: 1;
}
```

### 5. `.tableHeader sticky` — уточнить offset

После удаления `.root { overflow: hidden }` sticky теперь работает относительно `.main`. pageHeader остаётся первым sticky элементом (`top: 0`). tableHeader должен быть `top: 57px` (высота pageHeader ≈57px). Оставить как есть, проверить.

---

## Порядок выполнения

1. Применить правки 1–4 в `ChapanProduction.module.css`
2. Запустить Playwright E2E скриншот: `npx playwright test tests/e2e/chapan-production-redesign.spec.ts --headed`
3. Сравнить скриншот `playwright-report/cex-full-page.png` с handoff HTML
4. Если sticky не работает — скорректировать top offset или добавить `position: sticky; top: 0` с правильным значением

---

## Верификация

- Карточки показывают реальный контент (текст, кнопки, чекбоксы)
- Sticky header + table header закреплены при скролле
- Синий градиент table header виден
- Зелёная кнопка "Готово" видна в каждой карточке
- Срочные задания — красная левая полоса
- VIP — синяя левая полоса
