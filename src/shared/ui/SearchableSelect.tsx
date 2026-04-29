import { useDeferredValue, useEffect, useState } from 'react';
import styles from './SearchableSelect.module.css';

export type SearchableSelectOption =
  | string
  | {
      value: string;
      badge?: string;
      badgeKind?: 'ok' | 'low' | 'out';
    };

interface Props {
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function SearchableSelect({
  options,
  placeholder,
  className,
  value = '',
  onChange,
  onBlur,
  disabled,
  ariaLabel,
}: Props) {
  const [inputText, setInputText] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const deferredInput = useDeferredValue(inputText);

  useEffect(() => {
    setInputText(value);
  }, [value]);

  const normalizedOptions = options.map((option) =>
    typeof option === 'string'
      ? { value: option, badge: undefined, badgeKind: undefined }
      : option,
  );

  const filtered = !deferredInput
    ? normalizedOptions
    : normalizedOptions.filter((option) =>
        option.value.toLowerCase().includes(deferredInput.toLowerCase()),
      );

  useEffect(() => {
    if (!open || filtered.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex((current) => {
      if (current >= 0 && current < filtered.length) {
        return current;
      }

      const selectedIndex = filtered.findIndex((option) => option.value === value);
      return selectedIndex >= 0 ? selectedIndex : -1;
    });
  }, [filtered, open, value]);

  function commit(nextValue: string) {
    setInputText(nextValue);
    onChange(nextValue);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  return (
    <div className={styles.root}>
      <input
        type="text"
        value={inputText}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        aria-label={ariaLabel}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setInputText(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (filtered.length === 0) return;
            setOpen(true);
            setHighlightedIndex((current) => {
              if (current < 0) return 0;
              return current + 1 >= filtered.length ? 0 : current + 1;
            });
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (filtered.length === 0) return;
            setOpen(true);
            setHighlightedIndex((current) => {
              if (current < 0) return filtered.length - 1;
              return current - 1 < 0 ? filtered.length - 1 : current - 1;
            });
          }

          if (event.key === 'Enter' && open && highlightedIndex >= 0 && filtered[highlightedIndex]) {
            event.preventDefault();
            commit(filtered[highlightedIndex].value);
          }

          if (event.key === 'Escape') {
            setOpen(false);
            setHighlightedIndex(-1);
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            setOpen(false);
            setHighlightedIndex(-1);
            if (inputText !== value) {
              onChange(inputText);
            }
            onBlur?.();
          }, 150);
        }}
      />
      {open && filtered.length > 0 && (
        <ul className={styles.dropdown}>
          {filtered.map((option, index) => (
            <li
              key={option.value}
              className={`${styles.item}${option.value === value ? ` ${styles.itemSelected}` : ''}${index === highlightedIndex ? ` ${styles.itemActive}` : ''}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                commit(option.value);
              }}
            >
              <span>{option.value}</span>
              {option.badge && (
                <span
                  className={`${styles.badge} ${
                    option.badgeKind === 'low'
                      ? styles.badgeLow
                      : option.badgeKind === 'out'
                        ? styles.badgeOut
                        : styles.badgeOk
                  }`}
                >
                  {option.badge}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
