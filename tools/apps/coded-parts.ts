// Coded App（Action App と Web App）で共通に使う部品。@uipath/uipath-typescript の SDK を呼ぶ
//
//   - RecordList.tsx：Data Fabric のエンティティのレコードを表で見せる（Entities.getAllRecords / getRecordsByName。ページ送り付き）
//   - Attachment.tsx：添付（file の { ID }）を開く・画像で見せる（Attachments.getById → blobFileAccess の URI を fetch）
//
// API の形は SDK の型（node_modules/@uipath/uipath-typescript/dist/<subpath>/index.d.ts）と UiPath のスキル（uipath-coded-apps）に合わせた。

// ---- IR ----

export type RecordColumn = { field: string; label?: string }; // field はエンティティのフィールド名（大文字小文字もそのまま）
export type RecordList = {
  title: string; // 表の見出し
  entity?: string; // エンティティの名前（getRecordsByName）。entityId とどちらか 1 つ
  entityId?: string; // エンティティの Id（GUID。getAllRecords）
  columns: RecordColumn[];
  pageSize?: number; // 1 ページの件数（既定 25）
  folderKey?: string; // フォルダのエンティティのとき（SDK では experimental）
};
export type Issue = { path: string; code: string; message: string };

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function checkRecords(list: RecordList[] | undefined, at: string, add: (path: string, code: string, m: string) => void) {
  if (list === undefined) return;
  if (!Array.isArray(list)) { add(at, "APP_RECORDS", "records は配列"); return; }
  list.forEach((r, i) => {
    const p = `${at}[${i}]`;
    if (!r.title) add(`${p}.title`, "APP_RECORDS", "title（表の見出し）が要る");
    if (!!r.entity === !!r.entityId) add(`${p}.entity`, "APP_RECORDS", "entity（名前）か entityId（GUID）のどちらか 1 つを書く");
    if (r.entityId && !GUID.test(r.entityId)) add(`${p}.entityId`, "APP_RECORDS", "entityId は GUID");
    if (r.folderKey && !GUID.test(r.folderKey)) add(`${p}.folderKey`, "APP_RECORDS", "folderKey は GUID");
    if (!(r.columns ?? []).length) add(`${p}.columns`, "APP_RECORDS", "columns（見せるフィールド）が 1 つは要る");
    (r.columns ?? []).forEach((c, j) => { if (!c.field) add(`${p}.columns[${j}].field`, "APP_RECORDS", "field（フィールド名）が要る"); });
    if (r.pageSize !== undefined && !(Number.isInteger(r.pageSize) && r.pageSize >= 1 && r.pageSize <= 1000)) add(`${p}.pageSize`, "APP_RECORDS", "pageSize は 1〜1000 の整数");
  });
}

const js = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;

// <RecordList ... /> の JSX。service はレコードを読む Entities のインスタンスの式
export function recordListJsx(r: RecordList, service: string, ind: string): string {
  const cols = r.columns.map((c) => `{ field: ${js(c.field)}, label: ${js(c.label ?? c.field)} }`).join(", ");
  return [
    `${ind}<RecordList`,
    `${ind}  entities={${service}}`,
    `${ind}  title=${JSON.stringify(r.title)}`,
    r.entity ? `${ind}  entity=${JSON.stringify(r.entity)}` : `${ind}  entityId=${JSON.stringify(r.entityId)}`,
    `${ind}  columns={[${cols}]}`,
    `${ind}  pageSize={${r.pageSize ?? 25}}`,
    ...(r.folderKey ? [`${ind}  folderKey=${JSON.stringify(r.folderKey)}`] : []),
    `${ind}/>`,
  ].join("\n");
}

export const RECORD_LIST_TSX = `// tools/apps/coded-parts.ts が書いた。手で直さない
// Data Fabric のレコードを 1 ページずつ見せる。一覧の呼び出しはいつも 1 ページしか返さないので、カーソルでページを送る
import { useEffect, useState } from 'react';
import type { PaginationCursor } from '@uipath/uipath-typescript/core';
import type { Entities, EntityRecord } from '@uipath/uipath-typescript/entities';
import './RecordList.css';

export interface Column {
  field: string; // エンティティのフィールド名（大文字小文字もそのまま）
  label: string;
}

interface RecordListProps {
  entities: Entities;
  title: string;
  entity?: string; // 名前で読む（getRecordsByName）
  entityId?: string; // Id で読む（getAllRecords）
  columns: Column[];
  pageSize: number;
  folderKey?: string;
}

interface PageInfo {
  next?: PaginationCursor;
  prev?: PaginationCursor;
  total?: number;
  current?: number;
}

// 選択肢（choice set）は数（numberId）で来る。ファイルや関連は { name など } の形
const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'はい' : 'いいえ';
  if (typeof v === 'object') {
    const name = (v as { name?: unknown }).name;
    return typeof name === 'string' ? name : JSON.stringify(v);
  }
  return String(v);
};

function RecordList({ entities, title, entity, entityId, columns, pageSize, folderKey }: RecordListProps) {
  const [rows, setRows] = useState<EntityRecord[]>([]);
  const [cursor, setCursor] = useState<PaginationCursor | undefined>(undefined);
  const [page, setPage] = useState<PageInfo>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const load = cursor
      ? entityId
        ? entities.getAllRecords(entityId, { cursor, folderKey })
        : entities.getRecordsByName(entity ?? '', { cursor, folderKey })
      : entityId
        ? entities.getAllRecords(entityId, { pageSize, folderKey })
        : entities.getRecordsByName(entity ?? '', { pageSize, folderKey });
    load
      .then((res) => {
        if (!alive) return;
        setRows(res.items);
        setPage({ next: res.nextCursor, prev: res.previousCursor, total: res.totalCount, current: res.currentPage });
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [entities, entity, entityId, folderKey, pageSize, cursor]);

  const from = page.current ? (page.current - 1) * pageSize + 1 : 1;
  const to = from + rows.length - 1;

  return (
    <section className="record-list">
      <h2 className="record-list__title">{title}</h2>
      {error && <p className="record-list__error" role="alert">読み込めませんでした：{error}</p>}
      <div className="record-list__scroll">
        <table className="record-list__table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.field} title={c.label}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.Id)}>
                {columns.map((c) => {
                  const text = cell(r[c.field]);
                  return <td key={c.field} title={text}>{text}</td>;
                })}
              </tr>
            ))}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="record-list__empty">レコードはありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="record-list__pager">
        <span className="record-list__count">
          {loading ? '読み込み中…' : rows.length ? \`\${from}–\${to} 件\${page.total !== undefined ? \` / 全 \${page.total} 件\` : ''}\` : ''}
        </span>
        <button type="button" onClick={() => setCursor(page.prev)} disabled={loading || !page.prev}>前へ</button>
        <button type="button" onClick={() => setCursor(page.next)} disabled={loading || !page.next}>次へ</button>
      </div>
    </section>
  );
}

export default RecordList;
`;

// 色は Action App の index.css のトークン。無ければ（Web App）既定の色
export const RECORD_LIST_CSS = `/* tools/apps/coded-parts.ts が書いた。Data Fabric のレコードの表 */
.record-list { margin: 1.25rem 0; }
.record-list__title { margin: 0 0 0.6rem; font-size: 1rem; font-weight: 700; color: var(--text-primary, #1f2937); }
.record-list__scroll { overflow-x: auto; border: 1px solid var(--border-color, #d1d5db); border-radius: var(--radius-sm, 8px); }
.record-list__table { width: 100%; border-collapse: collapse; font-size: 0.86rem; table-layout: fixed; }
.record-list__table th, .record-list__table td { padding: 0.5rem 0.7rem; text-align: left; border-bottom: 1px solid var(--border-color, #e5e7eb); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary, #1f2937); }
.record-list__table th { background: var(--bg-hover, #f3f4f6); font-weight: 600; color: var(--text-secondary, #374151); }
.record-list__empty { text-align: center !important; color: var(--text-muted, #6b7280) !important; }
.record-list__error { color: #dc2626; font-size: 0.85rem; margin: 0 0 0.5rem; overflow-wrap: anywhere; }
.record-list__pager { display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.85rem; }
.record-list__count { margin-right: auto; color: var(--text-muted, #6b7280); }
.record-list__pager button { padding: 0.3rem 0.8rem; border: 1px solid var(--border-color, #d1d5db); border-radius: var(--radius-sm, 6px); background: var(--bg-input, #fff); color: var(--text-primary, #1f2937); cursor: pointer; }
.record-list__pager button:disabled { opacity: 0.45; cursor: default; }
`;

// 添付（Action App だけ）。attachments は '../uipath' の Attachments のインスタンス
export const ATTACHMENT_TSX = `// tools/apps/coded-parts.ts が書いた。手で直さない
// 添付（action-schema の file。値は { ID }）を SDK で取り出す。Attachments.getById → blobFileAccess の URI を fetch する
import { useEffect, useState } from 'react';
import { attachments } from '../uipath';

// requiresAuth のときは blobFileAccess.headers を付ける（スキルの sdk/orchestrator.md）
async function loadAttachment(id: string): Promise<{ url: string; name: string }> {
  const a = await attachments.getById(id);
  const { uri, headers, requiresAuth } = a.blobFileAccess;
  const res = await fetch(uri, requiresAuth ? { headers } : undefined);
  if (!res.ok) throw new Error(\`\${res.status} \${res.statusText}\`);
  return { url: URL.createObjectURL(await res.blob()), name: a.name };
}

interface AttachmentProps {
  id: string;
  mode: 'download' | 'image';
}

function Attachment({ id, mode }: AttachmentProps) {
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 画像は開いたときに読む
  useEffect(() => {
    if (mode !== 'image' || !id) return;
    let alive = true;
    let url = '';
    setError(null);
    loadAttachment(id)
      .then((f) => {
        url = f.url;
        if (alive) setFile(f);
        else URL.revokeObjectURL(f.url);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, mode]);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const f = file ?? (await loadAttachment(id));
      const a = document.createElement('a');
      a.href = f.url;
      a.download = f.name;
      a.click();
      if (!file) setTimeout(() => URL.revokeObjectURL(f.url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!id) return <span className="attachment__none">添付なし</span>;
  return (
    <div className="attachment">
      {mode === 'image' && file && <img className="attachment__image" src={file.url} alt={file.name} />}
      <div className="attachment__bar">
        {file && <span className="attachment__name" title={file.name}>{file.name}</span>}
        <button type="button" className="attachment__button" onClick={download} disabled={busy}>
          {busy ? '取り出し中…' : 'ダウンロード'}
        </button>
      </div>
      {error && <small className="attachment__error" role="alert">開けませんでした：{error}</small>}
    </div>
  );
}

export default Attachment;
`;
