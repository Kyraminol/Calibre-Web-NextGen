import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { BookCard } from '../components/BookCard';
import { Button } from '../components/Button';
import { Spinner, SpinnerCentered } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { useBooks } from '../lib/queries';
import type { Book } from '../lib/api';
import styles from './Catalog.module.css';

const SORT_OPTIONS = [
  { label: 'Newest', value: 'new' },
  { label: 'Oldest', value: 'old' },
  { label: 'Title A–Z', value: 'abc' },
  { label: 'Title Z–A', value: 'zyx' },
  { label: 'Author A–Z', value: 'authaz' },
  { label: 'Author Z–A', value: 'authza' },
  { label: 'Newest published', value: 'pubnew' },
  { label: 'Oldest published', value: 'pubold' },
];

export function Catalog() {
  const [page, setPage] = useState(1);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('new');
  // Track what key the accumulated allBooks belongs to so we can reset on change
  const accKeyRef = useRef<string>('1||new');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input 300ms; reset page + books on change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const { data, isLoading, isFetching, error } = useBooks(page, search, sort);

  // Accumulate pages, resetting when search/sort changes (page resets to 1)
  useEffect(() => {
    if (!data) return;
    const key = `${page}|${search}|${sort}`;
    if (page === 1 || accKeyRef.current.split('|').slice(1).join('|') !== `${search}|${sort}`) {
      // New search/sort — replace entirely
      setAllBooks(data.items);
      accKeyRef.current = key;
    } else {
      // Same search/sort, higher page — append deduped
      setAllBooks((prev) => {
        const existing = new Set(prev.map((b) => b.id));
        const newBooks = data.items.filter((b) => !existing.has(b.id));
        return newBooks.length > 0 ? [...prev, ...newBooks] : prev;
      });
      accKeyRef.current = key;
    }
  }, [data, page, search, sort]);

  const total = data?.total ?? 0;
  const loadedCount = allBooks.length;
  const hasMore = loadedCount < total;
  const isFirstLoad = isLoading && allBooks.length === 0;

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setPage(1);
  };

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Your Library</h1>
        {total > 0 && (
          <span className={styles.count}>
            {search
              ? `${total} result${total !== 1 ? 's' : ''} for "${search}"`
              : `${total} book${total !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search title, author…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search books"
          />
        </div>
        <select
          className={styles.sortSelect}
          value={sort}
          onChange={handleSortChange}
          aria-label="Sort order"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isFirstLoad ? (
        <SpinnerCentered size={36} />
      ) : error ? (
        <EmptyState message={error instanceof Error ? error.message : 'Failed to load books.'} />
      ) : allBooks.length === 0 && !isFetching ? (
        <EmptyState message={search ? `No results for "${search}".` : 'No books yet.'} />
      ) : (
        <>
          <div className={styles.grid}>
            {allBooks.map((book, i) => (
              <BookCard
                key={book.id}
                book={book}
                style={{ animationDelay: `${Math.min(i, 24) * 35}ms` }}
              />
            ))}
          </div>

          {hasMore && (
            <div className={styles.loadMore}>
              <Button
                variant="ghost"
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <Spinner size={16} />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
