import { useState, useRef, useEffect } from 'react';
import { Check, X, BookCopy, Trash2, CheckCheck } from 'lucide-react';
import { useBulkActions, useShelves, useMe } from '../lib/queries';
import { Spinner } from './Spinner';
import styles from './BulkBar.module.css';

interface BulkBarProps {
  ids: number[];
  onClear: () => void;
  /** Called after a mutation that changes what the catalog should show
   *  (read state / membership / deletion), so the grid can refresh. */
  onChanged?: () => void;
}

/** Floating action bar for the catalog's multi-select mode. Fans each action
 *  out over the selected book ids via the existing per-book endpoints. */
export function BulkBar({ ids, onClear, onChanged }: BulkBarProps) {
  const me = useMe().data;
  const { markRead, addToShelf, remove } = useBulkActions();
  const { data: shelvesData } = useShelves();
  const [shelfOpen, setShelfOpen] = useState(false);
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shelfOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (shelfRef.current && !shelfRef.current.contains(e.target as Node)) setShelfOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [shelfOpen]);

  const canDelete = !!me?.role?.delete_books;
  const canEditPublic = !!me?.role?.edit_shelfs;
  const editableShelves = (shelvesData?.items ?? []).filter(
    (s) => s.is_owner || (s.is_public && canEditPublic),
  );
  const busy = markRead.isPending || addToShelf.isPending || remove.isPending;
  const count = ids.length;

  const onDelete = () => {
    if (!window.confirm(`Delete ${count} book${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    remove.mutate(ids, { onSuccess: () => { onChanged?.(); onClear(); } });
  };

  const doMarkRead = (read: boolean) =>
    markRead.mutate({ ids, read }, { onSuccess: () => onChanged?.() });

  const doAddToShelf = (shelfId: number) => {
    addToShelf.mutate({ ids, shelfId }, { onSuccess: () => onChanged?.() });
    setShelfOpen(false);
  };

  return (
    <div className={styles.bar} role="toolbar" aria-label="Bulk actions">
      <span className={styles.count}>{count} selected</span>

      <div className={styles.actions}>
        <button className={styles.action} disabled={busy}
          onClick={() => doMarkRead(true)}>
          <CheckCheck size={15} /> Mark read
        </button>
        <button className={styles.action} disabled={busy}
          onClick={() => doMarkRead(false)}>
          <Check size={15} /> Mark unread
        </button>

        <div className={styles.shelfWrap} ref={shelfRef}>
          <button className={styles.action} disabled={busy || editableShelves.length === 0}
            onClick={() => setShelfOpen((o) => !o)}>
            <BookCopy size={15} /> Add to shelf
          </button>
          {shelfOpen && (
            <div className={styles.shelfMenu} role="menu">
              {editableShelves.map((s) => (
                <button key={s.id} className={styles.shelfItem} role="menuitem"
                  onClick={() => doAddToShelf(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {canDelete && (
          <button className={styles.actionDanger} disabled={busy} onClick={onDelete}>
            <Trash2 size={15} /> Delete
          </button>
        )}

        {busy && <Spinner size={16} />}
      </div>

      <button className={styles.clear} onClick={onClear} aria-label="Clear selection">
        <X size={18} />
      </button>
    </div>
  );
}
