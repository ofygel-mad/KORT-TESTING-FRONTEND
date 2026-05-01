/**
 * KORT · Цех — JSX-сниппет: обёртка tableScrollWrap
 * Файл: src/pages/workzone/chapan/production/ChapanProduction.tsx
 *
 * Найти в return() блок с tableHeader + cardList и обернуть в div ниже.
 */

// ─── Вариант A: простой общий scroll-wrapper (рекомендуется) ──────────────
//
// Минус: tableHeader теряет position:sticky по вертикали.
// Если sticky не критичен — это самое чистое решение.

export function TableScrollWrapSimple({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.tableScrollWrap}>
      {children}
    </div>
  );
}

// Использование в ChapanProductionPage return():
//
//   <div className={styles.tableScrollWrap}>
//     <div className={styles.tableHeader}>...</div>
//     <div className={styles.cardList}>...</div>
//   </div>


// ─── Вариант B: sticky header + sync scroll через JS ─────────────────────
//
// Сохраняет sticky поведение хедера по вертикали.
// Оба контейнера (header + list) синхронизируют scrollLeft друг с другом.

import { useRef, useCallback } from 'react';

export function useSyncScroll() {
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  const onHeaderScroll = useCallback(() => {
    if (headerRef.current && listRef.current) {
      listRef.current.scrollLeft = headerRef.current.scrollLeft;
    }
  }, []);

  const onListScroll = useCallback(() => {
    if (listRef.current && headerRef.current) {
      headerRef.current.scrollLeft = listRef.current.scrollLeft;
    }
  }, []);

  return { headerRef, listRef, onHeaderScroll, onListScroll };
}

// Использование в ChapanProductionPage:
//
//   const { headerRef, listRef, onHeaderScroll, onListScroll } = useSyncScroll();
//
//   // В return():
//   <div
//     ref={headerRef}
//     className={styles.tableHeader}
//     style={{ overflowX: 'hidden' }}
//     onScroll={onHeaderScroll}
//   >
//     ...12 колонок...
//   </div>
//
//   <div
//     ref={listRef}
//     className={styles.cardList}
//     style={{ overflowX: 'auto' }}
//     onScroll={onListScroll}
//   >
//     ...карточки...
//   </div>
//
// При этом в CSS у .tableHeader оставить position: sticky; top: var(--workshop-header-offset);
// но убрать overflow-x (он теперь inline style 'hidden').
