'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useId, memo } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import type { JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface Book {
  title: string;
  authors: string[];
  publisher: string;
  isbn: string;
  thumbnail: string;
}

interface QuoteComment {
  id: string;
  content: string;
  created_at: string;
}

interface QuoteItem {
  id: string;
  content: string;
  created_at: string;
  quote_comments: QuoteComment[];
}

interface Review {
  id: string;
  user_id: string;
  book_isbn: string;
  rating: number;
  content: string;
  content_json?: JSONContent | null;
  status: Status;
  created_at: string;
  books: {
    title: string;
    author: string;
    cover_url: string;
  };
  quotes?: QuoteItem[];
}

type Tab = 'shelf' | 'reviews' | 'scraps' | 'mine' | 'profile';

interface NavState {
  tab: Tab;
  activeId: string | null;
  activeSeries: string | null;
  activeClipId: string | null;
}
const NAV_DEFAULT: NavState = {
  tab: 'shelf',
  activeId: null,
  activeSeries: null,
  activeClipId: null,
};
type Status = 'wishlist' | 'reading' | 'completed';

interface Profile {
  nickname: string;
  seal_text: string | null;
  seal_color: string | null;
  seal_style: string | null;
  seal_image: string | null;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

interface ProfileRow {
  id: string;
  nickname: string;
  seal_text?: string | null;
  seal_color?: string | null;
  seal_style?: string | null;
  seal_image?: string | null;
}
type ProfilesResult = { data: ProfileRow[] | null; error: { message: string } | null };

const byCreated = (a: { created_at: string }, b: { created_at: string }) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

const STAR_PATH =
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

function Star({ fill, size = 20 }: { fill: number; size?: number }) {
  const clipId = useId().replace(/:/g, '');
  const fillWidth = 24 * Math.min(1, Math.max(0, fill));

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={`${Math.round(fill * 100)}% 별점`}>
      <path d={STAR_PATH} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={fillWidth} height="24" />
        </clipPath>
      </defs>
      <path d={STAR_PATH} fill="currentColor" clipPath={`url(#${clipId})`} />
    </svg>
  );
}

function RatingDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={Math.min(1, Math.max(0, value - i))} size={size} />
      ))}
    </span>
  );
}

function RatingInput({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div aria-label="별점 선택">
      <div onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            aria-label={`${score}점`}
            aria-pressed={value === score}
            onMouseEnter={() => setHover(score)}
            onFocus={() => setHover(score)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(value === score ? 0 : score)}
          >
            <Star fill={Math.min(1, Math.max(0, shown - score + 1))} size={size} />
          </button>
        ))}
      </div>
      <span>
        {value > 0 ? `${value.toFixed(1)}점` : '별점 선택'}
      </span>
    </div>
  );
}

function ToggleButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ReadingBadge() {
  return (
    <span>
      읽는 중
    </span>
  );
}

function ReplyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M5 4v7a3 3 0 0 0 3 3h11" />
      <path d="M15 10l4 4-4 4" />
    </svg>
  );
}

function Spoiler({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={shown ? '스포일러 내용' : '스포일러 보기'}
      onClick={(e) => {
        e.stopPropagation();
        setShown(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShown(true);
        }
      }}
    >
      {shown ? children : '[스포일러: 클릭하여 보기]'}
    </span>
  );
}

type InlinePattern = {
  re: RegExp;
  render: (m: RegExpExecArray, key: string) => React.ReactNode;
  valid?: (m: RegExpExecArray, src: string, offset: number) => boolean;
};

const isWordChar = (c?: string) => !!c && /[0-9A-Za-z가-힣]/.test(c);

const INLINE: InlinePattern[] = [
  { re: /\\([\\*_~`|>#\[\]()\-])/, render: (m) => m[1] },
  {
    re: /(`{1,3})([\s\S]+?)\1/,
    render: (m, key) => (
      <code
        key={key}
      >
        {m[2]}
      </code>
    ),
  },
  {
    re: /\|\|([\s\S]+?)\|\|/,
    render: (m, key) => <Spoiler key={key}>{parseInline(m[1], key)}</Spoiler>,
  },
  {
    re: /\*\*\*([\s\S]+?)\*\*\*/,
    render: (m, key) => (
      <strong key={key}>
        <em>{parseInline(m[1], key)}</em>
      </strong>
    ),
  },
  {
    re: /\*\*([\s\S]+?)\*\*/,
    render: (m, key) => <strong key={key}>{parseInline(m[1], key)}</strong>,
  },
  {
    re: /__([\s\S]+?)__/,
    render: (m, key) => <u key={key}>{parseInline(m[1], key)}</u>,
  },
  {
    re: /~~([\s\S]+?)~~/,
    render: (m, key) => <s key={key}>{parseInline(m[1], key)}</s>,
  },
  {
    re: /\*([^\s*](?:[\s\S]*?[^\s*])?)\*/,
    render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em>,
  },
  {
    re: /_([^\s_](?:[\s\S]*?[^\s_])?)_/,
    valid: (m, src, offset) =>
      !isWordChar(src[offset + m.index - 1]) && !isWordChar(src[offset + m.index + m[0].length]),
    render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em>,
  },
  {
    re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
    render: (m, key) => (
      <a
        key={key}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={(e) => e.stopPropagation()}
      >
        {m[1]}
      </a>
    ),
  },
  {
    re: /https?:\/\/[^\s<>)\]]*[^\s<>)\].,!?;:'"]/,
    render: (m, key) => (
      <a
        key={key}
        href={m[0]}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={(e) => e.stopPropagation()}
      >
        {m[0]}
      </a>
    ),
  },
];

function parseInline(src: string, keyBase = 'i'): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let rest = src;
  let offset = 0;
  let n = 0;

  while (rest.length > 0) {
    let best: { p: InlinePattern; m: RegExpExecArray } | null = null;
    for (const p of INLINE) {
      const m = p.re.exec(rest);
      if (!m) continue;
      if (p.valid && !p.valid(m, src, offset)) continue;
      if (!best || m.index < best.m.index) best = { p, m };
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    const { p, m } = best;
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    nodes.push(p.render(m, `${keyBase}-${n++}`));
    const consumed = m.index + m[0].length;
    offset += consumed;
    rest = rest.slice(consumed);
  }
  return nodes;
}

function renderBlocks(text: string, keyBase = 'b'): React.ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let k = 0;
  const key = () => `${keyBase}-${k++}`;

  const flush = () => {
    const joined = para.join('\n').replace(/^\n+|\n+$/g, '');
    if (joined.trim()) {
      const kk = key();
      out.push(<p key={kk}>{parseInline(joined, kk)}</p>);
    }
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```') && (trimmed.match(/```/g) || []).length === 1) {
      const body: string[] = [];
      const first = trimmed.slice(3);
      if (first && !/^[\w+#.-]+$/.test(first)) body.push(first);
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        const idx = lines[j].indexOf('```');
        if (idx !== -1) {
          if (idx > 0) body.push(lines[j].slice(0, idx));
          closed = true;
          break;
        }
        body.push(lines[j]);
        j++;
      }
      if (closed) {
        flush();
        out.push(
          <pre
            key={key()}
          >
            <code>{body.join('\n')}</code>
          </pre>
        );
        i = j + 1;
        continue;
      }
    }

    if (/^>>>(\s|$)/.test(trimmed)) {
      flush();
      const restText = [trimmed.replace(/^>>>\s?/, ''), ...lines.slice(i + 1)].join('\n');
      out.push(
        <blockquote key={key()}>
          {renderBlocks(restText, key())}
        </blockquote>
      );
      i = lines.length;
      break;
    }

    if (/^\s*>\s?/.test(line)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote key={key()}>
          {renderBlocks(q.join('\n'), key())}
        </blockquote>
      );
      continue;
    }

    const h = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flush();
      const kk = key();
      const headingLevel = h[1].length;
      const Heading = headingLevel === 1 ? 'h1' : headingLevel === 2 ? 'h2' : 'h3';
      out.push(
        <Heading key={kk}>
          {parseInline(h[2], kk)}
        </Heading>
      );
      i++;
      continue;
    }

    const sub = trimmed.match(/^-#\s+(.+)$/);
    if (sub) {
      flush();
      const kk = key();
      out.push(
        <p key={kk}>
          {parseInline(sub[1], kk)}
        </p>
      );
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      const kk = key();
      out.push(
        <ul key={kk}>
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it, `${kk}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      const kk = key();
      out.push(
        <ol key={kk}>
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it, `${kk}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    para.push(line);
    i++;
  }

  flush();
  return out;
}

const BLOCK_SYNTAX = /^\s*(#{1,3}\s|-#\s|>|[-*]\s|\d+[.)]\s)|```/m;

function DiscordText({
  text,
  wrapQuotes = false,
}: {
  text: string;
  
  wrapQuotes?: boolean;
}) {
  const src = wrapQuotes && !BLOCK_SYNTAX.test(text) ? `"${text}"` : text;
  return <div>{renderBlocks(src)}</div>;
}

function QuoteList({
  quotes,
  isOwner = false,
  onDeleteQuote,
  onAddComment,
  onDeleteComment,
}: {
  quotes: QuoteItem[];
  isOwner?: boolean;
  onDeleteQuote?: (id: string) => void;
  onAddComment?: (quoteId: string, text: string) => Promise<boolean>;
  onDeleteComment?: (commentId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const toggle = (id: string) => {
    setDraft('');
    setOpenId((prev) => (prev === id ? null : id));
  };

  const submit = async (e: React.FormEvent, quoteId: string) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !onAddComment) return;
    const ok = await onAddComment(quoteId, text);
    if (ok) setDraft('');
  };

  return (
    <div>
      {quotes.map((q) => (
        <div key={q.id}>
          <div>
            <div
              onClick={isOwner ? () => toggle(q.id) : undefined}
            >
              <DiscordText text={q.content} wrapQuotes />
            </div>
            {onDeleteQuote && (
              <button
                type="button"
                onClick={() => onDeleteQuote(q.id)}
                aria-label="인용문 삭제"
                title="인용문 삭제"
              >
                ×
              </button>
            )}
          </div>

          {q.quote_comments.length > 0 && (
            <div>
              {q.quote_comments.map((c) => (
                <div key={c.id}>
                  <ReplyIcon />
                  <DiscordText text={c.content} />
                  {isOwner && onDeleteComment && (
                    <button
                      type="button"
                      onClick={() => onDeleteComment(c.id)}
                      aria-label="댓글 삭제"
                      title="댓글 삭제"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwner && openId === q.id && (
            <form onSubmit={(e) => submit(e, q.id)}>
              <input
                type="text"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="코멘트를 입력하세요"
              />
              <button type="submit">
                등록
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

const SEAL_COLORS: Record<string, { label: string; hex: string }> = {
  ink: { label: '먹색', hex: '#202328' },
  red: { label: '진회색', hex: '#555555' },
  grey: { label: '회색', hex: '#555a62' },
};

const SEAL_STYLES: [string, string][] = [
  ['solid', '채움'],
  ['outline', '테두리'],
  ['double', '겹테두리'],
];

function Seal({
  text,
  color = 'ink',
  styleType = 'solid',
  size = 20,
  image = '',
  onImageError,
}: {
  text: string;
  color?: string;
  styleType?: string;
  size?: number;
  image?: string | null;
  onImageError?: () => void;
}) {
  if (image) {
    return (
      <span aria-hidden="true" data-seal-color={color} data-seal-style={styleType} data-seal-size={size}>
        <img src={image} alt="" onError={onImageError} />
      </span>
    );
  }
  const chars = Array.from(text || '').slice(0, 2).join('');
  return (
    <span aria-hidden="true" data-seal-color={color} data-seal-style={styleType} data-seal-size={size}>
      {chars}
    </span>
  );
}

function WishBadge() {
  return (
    <span>
      읽고 싶음
    </span>
  );
}

function StatusCell({ review, size = 13 }: { review: Review; size?: number }) {
  if (review.status === 'reading') return <ReadingBadge />;
  if (review.status === 'wishlist') return <WishBadge />;
  return <RatingDisplay value={review.rating} size={size} />;
}

interface SeriesVolume {
  volume: number;
  label: string;
  reviews: Review[];
}

interface SeriesEntry {
  type: 'series';
  key: string;
  base: string;
  author: string;
  cover: string;
  volumes: SeriesVolume[];
  reviews: Review[];
  latest: string;
}

type CommunityEntry = { type: 'review'; review: Review } | SeriesEntry;

const cleanBase = (s: string) => s.replace(/[\s\-:,.·~]+$/, '').trim();
const normKey = (s: string) => s.toLowerCase().replace(/\s+/g, '');

function parseSeries(rawTitle: string): { base: string; volume: number; label: string } | null {
  const t = rawTitle.trim();
  const candidates = [t, t.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/, '').trim()];

  for (const s of candidates) {
    if (!s) continue;
    let m: RegExpMatchArray | null;

    m = s.match(/^(.*\S)[\s,]*(?:vol\.?|volume|#)\s*(\d{1,3})$/i);
    if (m) return finish(m[1], Number(m[2]), `${Number(m[2])}권`);

    m = s.match(/^(.*\S)\s*[\(\[]\s*(\d{1,3})\s*[\)\]]$/);
    if (m) return finish(m[1], Number(m[2]), `${Number(m[2])}권`);

    m = s.match(/^(.*?\S)\s*(?:제\s*)?(\d{1,3})\s*권$/);
    if (m) return finish(m[1], Number(m[2]), `${Number(m[2])}권`);

    m = s.match(/^(.*\S)\s+(\d{1,3})$/);
    if (m) return finish(m[1], Number(m[2]), `${Number(m[2])}권`);

    m = s.match(/^(.*\S)[\s\(\[]+(상|중|하)\s*(?:권)?\s*[\)\]]?$/);
    if (m) {
      const order = { 상: 1, 중: 2, 하: 3 } as Record<string, number>;
      return finish(m[1], order[m[2]], `${m[2]}권`);
    }
  }
  return null;

  function finish(base: string, volume: number, label: string) {
    const b = cleanBase(base);
    if (Array.from(b).length < 2 || /^\d+$/.test(b) || volume > 200) return null;
    return { base: b, volume, label };
  }
}

function buildCommunityEntries(list: Review[]): CommunityEntry[] {
  const buckets = new Map<
    string,
    { base: string; author: string; vols: Map<number, SeriesVolume>; reviews: Review[] }
  >();
  const singles: Review[] = [];

  for (const r of list) {
    const info = parseSeries(r.books.title);
    if (!info) {
      singles.push(r);
      continue;
    }
    const key = `${normKey(info.base)}|${normKey((r.books.author || '').split(',')[0])}`;
    let b = buckets.get(key);
    if (!b) {
      b = { base: info.base, author: r.books.author, vols: new Map(), reviews: [] };
      buckets.set(key, b);
    }
    let v = b.vols.get(info.volume);
    if (!v) {
      v = { volume: info.volume, label: info.label, reviews: [] };
      b.vols.set(info.volume, v);
    }
    v.reviews.push(r);
    b.reviews.push(r);
  }

  const entries: CommunityEntry[] = [];
  buckets.forEach((b, key) => {
    if (b.vols.size >= 2) {
      const volumes = Array.from(b.vols.values()).sort((x, y) => x.volume - y.volume);
      const latest = b.reviews.reduce((m, r) => (r.created_at > m ? r.created_at : m), '');
      entries.push({
        type: 'series',
        key,
        base: b.base,
        author: b.author,
        cover: volumes[0].reviews[0].books.cover_url,
        volumes,
        reviews: b.reviews,
        latest,
      });
    } else {
      b.reviews.forEach((r) => singles.push(r));
    }
  });
  singles.forEach((r) => entries.push({ type: 'review', review: r }));

  const when = (e: CommunityEntry) => (e.type === 'series' ? e.latest : e.review.created_at);
  return entries.sort((a, b) => (when(b) > when(a) ? 1 : when(b) < when(a) ? -1 : 0));
}

interface ClipHighlight {
  id: string;
  start_offset: number;
  end_offset: number;
  color: 'red' | 'blue' | 'erase';
  created_at: string;
}

interface ClipNote {
  id: string;
  start_offset: number;
  end_offset: number;
  quote_text: string;
  content: string;
  created_at: string;
}

interface Clipping {
  id: string;
  title: string;
  source: string | null;
  content: string;
  created_at: string;
  clip_highlights: ClipHighlight[];
  clip_notes: ClipNote[];
}

const sortNotes = (notes: ClipNote[]) =>
  [...notes].sort((a, b) => a.end_offset - b.end_offset || byCreated(a, b));

function measureOffset(container: HTMLElement, node: Node, offset: number): number {
  const r = document.createRange();
  r.selectNodeContents(container);
  r.setEnd(node, offset);
  const frag = r.cloneContents();
  frag.querySelectorAll('[data-fn]').forEach((el) => el.remove());
  return (frag.textContent || '').length;
}

function scrollToNote(noteId: string) {
  document.getElementById(`note-${noteId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const ClipArticle = memo(function ClipArticle({
  content,
  highlights,
  notes,
  containerRef,
}: {
  content: string;
  highlights: ClipHighlight[];
  notes: ClipNote[];
  containerRef: React.Ref<HTMLDivElement>;
}) {
  const nodes = useMemo(() => {
    const clamp = (n: number) => Math.max(0, Math.min(content.length, n));
    const sorted = sortNotes(notes);
    const numberOf = new Map<string, number>();
    sorted.forEach((n, i) => numberOf.set(n.id, i + 1));

    const pts = new Set<number>([0, content.length]);
    highlights.forEach((h) => {
      pts.add(clamp(h.start_offset));
      pts.add(clamp(h.end_offset));
    });
    notes.forEach((n) => {
      pts.add(clamp(n.start_offset));
      pts.add(clamp(n.end_offset));
    });
    const points = Array.from(pts).sort((a, b) => a - b);

    const out: React.ReactNode[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (b <= a) continue;

      let color: string | null = null;
      for (const h of highlights) {
        if (h.start_offset <= a && h.end_offset >= b) color = h.color === 'erase' ? null : h.color;
      }
      const noted = notes.some((n) => n.start_offset <= a && n.end_offset >= b);

      const segment = content.slice(a, b);
      if (color) {
        out.push(<mark key={`s${a}`} data-highlight-color={color}>{segment}</mark>);
      } else if (noted) {
        out.push(<u key={`s${a}`} data-has-note="true">{segment}</u>);
      } else {
        out.push(<span key={`s${a}`} data-start={a}>{segment}</span>);
      }

      sorted
        .filter((n) => clamp(n.end_offset) === b)
        .forEach((n) => {
          out.push(
            <sup
              key={`f${n.id}`}
              data-fn={numberOf.get(n.id)}
              onClick={() => scrollToNote(n.id)}
            >
              {numberOf.get(n.id)})
            </sup>
          );
        });
    }
    return out;
  }, [content, highlights, notes]);

  return (
    <div ref={containerRef}>
      {nodes}
    </div>
  );
});

const CROP_VIEW = 220;

async function loadOrientedCanvas(file: File, maxSide = 1200): Promise<HTMLCanvasElement> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' } as unknown as ImageBitmapOptions);
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('이미지를 읽지 못했어요.'));
      };
      img.src = url;
    });
  }

  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!w || !h) throw new Error('이미지를 읽지 못했어요.');

  const k = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 처리하지 못했어요.');
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cropRectOf(natW: number, natH: number, zoom: number, ox: number, oy: number) {
  const s = (CROP_VIEW / Math.min(natW, natH)) * zoom;
  return {
    s,
    size: CROP_VIEW / s,
    sx: ((natW * s) / 2 - CROP_VIEW / 2 - ox) / s,
    sy: ((natH * s) / 2 - CROP_VIEW / 2 - oy) / s,
  };
}

function clampCropOffset(natW: number, natH: number, zoom: number, o: { x: number; y: number }) {
  const s = (CROP_VIEW / Math.min(natW, natH)) * zoom;
  const maxX = Math.max(0, (natW * s - CROP_VIEW) / 2);
  const maxY = Math.max(0, (natH * s - CROP_VIEW) / 2);
  return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
}

function renderCrop(
  source: HTMLCanvasElement,
  r: { sx: number; sy: number; size: number },
  out: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(source, r.sx, r.sy, r.size, r.size, 0, 0, out, out);
  }
  return canvas;
}

function SealCropper({
  source,
  sealColor,
  onConfirm,
  onCancel,
}: {
  source: HTMLCanvasElement;
  sealColor: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const natW = source.width;
  const natH = source.height;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [previewUrl, setPreviewUrl] = useState('');
  const displaySrc = useMemo(() => source.toDataURL('image/jpeg', 0.92), [source]);
  const viewRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastDist = useRef(0);

  useEffect(() => {
    setOffset((o) => clampCropOffset(natW, natH, zoom, o));
  }, [zoom, natW, natH]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(1, +(z - e.deltaY * 0.002).toFixed(3))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const r = cropRectOf(natW, natH, zoom, offset.x, offset.y);
      setPreviewUrl(renderCrop(source, r, 160).toDataURL('image/jpeg', 0.85));
    });
    return () => cancelAnimationFrame(id);
  }, [source, natW, natH, zoom, offset.x, offset.y]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastDist.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);

    if (pointers.current.size === 1) {
      setOffset((o) => clampCropOffset(natW, natH, zoom, { x: o.x + (cur.x - prev.x), y: o.y + (cur.y - prev.y) }));
    } else {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist.current > 0) {
        setZoom((z) => Math.min(4, Math.max(1, +(z * (dist / lastDist.current)).toFixed(3))));
      }
      lastDist.current = dist;
    }
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    lastDist.current = 0;
  };

  const confirm = () => {
    const r = cropRectOf(natW, natH, zoom, offset.x, offset.y);
    renderCrop(source, r, 256).toBlob(
      (blob) => (blob ? onConfirm(blob) : alert('이미지를 처리하지 못했어요.')),
      'image/jpeg',
      0.88
    );
  };

  const s = (CROP_VIEW / Math.min(natW, natH)) * zoom;
  const dispW = natW * s;
  const dispH = natH * s;

  return (
    <div>
      <p>사진 자르기</p>

      <div>
        <div
          ref={viewRef}
          style={{ width: CROP_VIEW, height: CROP_VIEW, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <img
            src={displaySrc}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: CROP_VIEW / 2 - dispW / 2 + offset.x,
              top: CROP_VIEW / 2 - dispH / 2 + offset.y,
              width: dispW,
              height: dispH,
              maxWidth: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div>
          <p>미리보기</p>
          <div>
            <Seal text="" color={sealColor} image={previewUrl} size={88} />
            <Seal text="" color={sealColor} image={previewUrl} size={48} />
            <Seal text="" color={sealColor} image={previewUrl} size={26} />
          </div>
          <p>실제로 이렇게 기울어진 도장으로 보여요.</p>
        </div>
      </div>

      <div>
        <label>확대</label>
        <div>
          <button
            type="button"
            aria-label="축소"
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
          >
            -
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="확대 비율"
          />
          <button
            type="button"
            aria-label="확대"
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
          >
            +
          </button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      <p>
        사진을 드래그해서 위치를 맞추고, 슬라이더나 마우스 휠(휴대폰은 두 손가락)로 확대해요.
      </p>

      <div>
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <button type="button" onClick={confirm}>
          적용
        </button>
      </div>
    </div>
  );
}

function sealPathFromUrl(url: string, uid: string): string | null {
  const marker = '/seals/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  return path.startsWith(`${uid}/`) ? path : null;
}

function BookCover({
  title,
  author,
  src,
}: {
  title: string;
  author?: string;
  src?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img src={src} alt={title} onError={() => setBroken(true)} />;
  }
  return (
    <span>
      {title}
      {author && <span>{author}</span>}
    </span>
  );
}

const plainText = (md: string): string =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[>#\-*\d.)\s]+/gm, '')
    .replace(/[*_~`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const excerptOf = (md: string, max = 120): string => {
  const t = plainText(md);
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

const fmtMD = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${String(d.getDate()).padStart(2, '0')}일`;
};

interface ShelfBook {
  type: 'book';
  isbn: string;
  book: Review['books'];
  reviews: Review[];
}
type ShelfEntry = ShelfBook | SeriesEntry;

function buildShelfEntries(list: Review[]): ShelfEntry[] {
  const out: ShelfEntry[] = [];
  const byIsbn = new Map<string, ShelfBook>();
  for (const e of buildCommunityEntries(list)) {
    if (e.type === 'series') {
      out.push(e);
      continue;
    }
    const r = e.review;
    let b = byIsbn.get(r.book_isbn);
    if (!b) {
      b = { type: 'book', isbn: r.book_isbn, book: r.books, reviews: [] };
      byIsbn.set(r.book_isbn, b);
      out.push(b);
    }
    b.reviews.push(r);
  }
  return out;
}

function shelfStatusOf(reviews: Review[]): Status {
  if (reviews.some((r) => r.status === 'reading')) return 'reading';
  if (reviews.some((r) => r.status === 'completed')) return 'completed';
  return 'wishlist';
}

const STATUS_LABEL: Record<Status, string> = {
  wishlist: '읽고 싶은 책',
  reading: '읽는 중',
  completed: '완독',
};

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: false,
    underline: false,
    strike: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
  }),
];

interface DraftRow {
  review_id: string;
  content_json: JSONContent | null;
  content_text: string;
  updated_at: string;
}

const textToDoc = (text: string): JSONContent => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return {
    type: 'doc',
    content: lines.map((l) => (l.trim() ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })),
  };
};

function RichView({ json }: { json: JSONContent }) {
  const editor = useEditor(
    { extensions: TIPTAP_EXTENSIONS, content: json, editable: false, immediatelyRender: false },
    [JSON.stringify(json)]
  );
  return <EditorContent editor={editor} />;
}

function ReviewBody({ review }: { review: Review }) {
  if (review.content_json) return <RichView json={review.content_json} />;
  return <DiscordText text={review.content} />;
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

function ReviewEditorPanel({
  review,
  userId,
  draft,
  onDraftChange,
  onDone,
}: {
  review: Review;
  userId: string;
  draft: DraftRow | null;
  onDraftChange: (reviewId: string, draft: DraftRow | null) => void;
  onDone: (published: boolean) => void;
}) {
  const [initial] = useState<JSONContent>(
    () => draft?.content_json ?? review.content_json ?? textToDoc(review.content || '')
  );
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<string | null>(draft?.updated_at ?? null);
  const [preview, setPreview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<JSONContent>(initial);
  const [busy, setBusy] = useState(false);

  const docRef = useRef<{ json: JSONContent; text: string } | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    const doc = docRef.current;
    if (!doc || !dirty.current) return true;
    if (mounted.current) setSaveState('saving');
    const row: DraftRow = {
      review_id: review.id,
      content_json: doc.json,
      content_text: doc.text,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('review_drafts')
      .upsert({ ...row, user_id: userId }, { onConflict: 'review_id' });
    if (error) {
      console.error('임시 저장 실패:', error.message);
      if (mounted.current) setSaveState('error');
      return false;
    }
    if (docRef.current === doc) dirty.current = false;
    onDraftChange(review.id, row);
    if (mounted.current) {
      setSaveState(dirty.current ? 'dirty' : 'saved');
      setSavedAt(row.updated_at);
    }
    return true;
  }, [review.id, userId, onDraftChange]);

  const saveRef = useRef(saveDraft);
  useEffect(() => {
    saveRef.current = saveDraft;
  }, [saveDraft]);

  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: initial,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { 'aria-label': '독후감 본문' } },
    onUpdate: ({ editor: ed }) => {
      docRef.current = { json: ed.getJSON(), text: ed.getText({ blockSeparator: '\n' }) };
      dirty.current = true;
      setSaveState('dirty');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => saveRef.current(), 1500);
    },
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      h2: !!ed?.isActive('heading', { level: 2 }),
      h3: !!ed?.isActive('heading', { level: 3 }),
      bold: !!ed?.isActive('bold'),
      italic: !!ed?.isActive('italic'),
      quote: !!ed?.isActive('blockquote'),
      bullet: !!ed?.isActive('bulletList'),
      ordered: !!ed?.isActive('orderedList'),
      canUndo: !!ed?.can().undo(),
      canRedo: !!ed?.can().redo(),
    }),
  }) ?? {
    h2: false,
    h3: false,
    bold: false,
    italic: false,
    quote: false,
    bullet: false,
    ordered: false,
    canUndo: false,
    canRedo: false,
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      if (dirty.current) saveRef.current();
    };
  }, []);

  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const saveNow = async () => {
    window.clearTimeout(timer.current);
    await saveDraft();
  };

  const publish = async () => {
    if (!editor) return;
    const json = editor.getJSON();
    const text = editor.getText({ blockSeparator: '\n' });
    if (!text.trim()) return alert('내용을 입력한 뒤 발행해 주세요.');

    setBusy(true);
    window.clearTimeout(timer.current);
    const { error } = await supabase.from('reviews').update({ content: text, content_json: json }).eq('id', review.id);
    if (error) {
      setBusy(false);
      return alert(
        error.message.includes('content_json')
          ? '발행에 필요한 컬럼이 아직 없어요. Supabase에서 안내드린 SQL을 먼저 실행해 주세요.'
          : `발행 실패: ${error.message}`
      );
    }
    await supabase.from('review_drafts').delete().eq('review_id', review.id);
    dirty.current = false;
    onDraftChange(review.id, null);
    setBusy(false);
    onDone(true);
  };

  const close = async () => {
    window.clearTimeout(timer.current);
    if (dirty.current) await saveDraft();
    onDone(false);
  };

  const discard = async () => {
    if (!confirm('임시 저장한 글을 지우시겠습니까?')) return;
    window.clearTimeout(timer.current);
    dirty.current = false;
    await supabase.from('review_drafts').delete().eq('review_id', review.id);
    onDraftChange(review.id, null);
    onDone(false);
  };

  const togglePreview = () => {
    if (!preview && editor) setPreviewDoc(editor.getJSON());
    setPreview(!preview);
  };

  const tool = (on: boolean, label: string, run: () => void, disabled = false) => (
    <button
      type="button"
      key={label}
      aria-pressed={on}
      disabled={disabled || !editor}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );

  const statusText =
    saveState === 'saving'
      ? '저장 중…'
      : saveState === 'dirty'
        ? '변경 사항이 있어요'
        : saveState === 'error'
          ? '저장 실패'
          : savedAt
            ? `임시 저장 완료 · ${new Date(savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
            : '아직 저장하지 않았어요';

  return (
    <div>
      {review.content && (
        <p>
          발행된 글을 고치는 중이에요. 발행하기 전까지는 다른 멤버에게 이전에 발행한 글이 보여요.
        </p>
      )}

      <div>
        {tool(active.h2, '제목', () => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
        {tool(active.h3, '소제목', () => editor?.chain().focus().toggleHeading({ level: 3 }).run())}
        {tool(active.bold, '굵게', () => editor?.chain().focus().toggleBold().run())}
        {tool(active.italic, '기울임', () => editor?.chain().focus().toggleItalic().run())}
        {tool(active.quote, '인용문', () => editor?.chain().focus().toggleBlockquote().run())}
        {tool(active.bullet, '목록', () => editor?.chain().focus().toggleBulletList().run())}
        {tool(active.ordered, '번호 목록', () => editor?.chain().focus().toggleOrderedList().run())}
        {tool(false, '되돌리기', () => editor?.chain().focus().undo().run(), !active.canUndo)}
        {tool(false, '다시 하기', () => editor?.chain().focus().redo().run(), !active.canRedo)}
      </div>

      <div>
        <EditorContent editor={editor} />
      </div>
      {preview && (
        <div>
          <RichView json={previewDoc} />
        </div>
      )}

      <div>
        <span
          role="status"
        >
          {statusText}
          {saveState === 'error' && (
            <button type="button" onClick={saveNow}>
              다시 시도
            </button>
          )}
        </span>
        <div>
          {draft && (
            <button type="button" onClick={discard}>
              임시 저장 삭제
            </button>
          )}
          <button type="button" onClick={togglePreview}>
            {preview ? '편집으로' : '미리보기'}
          </button>
          <button type="button" onClick={saveNow} disabled={saveState === 'saving'}>
            임시 저장
          </button>
          <button type="button" onClick={close}>
            닫기
          </button>
          <button type="button" onClick={publish} disabled={busy}>
            {busy ? '발행 중…' : '발행'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    document.title = '독-서팟';
  }, []);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [regStatus, setRegStatus] = useState<Status>('completed');
  const [rating, setRating] = useState<number>(0);
  const [searchLoading, setSearchLoading] = useState(false);

  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const [tab, setTab] = useState<Tab>('shelf');
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [boardFilter, setBoardFilter] = useState('');
  const [showOthers, setShowOthers] = useState(true);
  const [newQuoteInput, setNewQuoteInput] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [today, setToday] = useState('');

  const [activeSeries, setActiveSeries] = useState<string | null>(null);

  const [clippings, setClippings] = useState<Clipping[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [clipTitle, setClipTitle] = useState('');
  const [clipSource, setClipSource] = useState('');
  const [clipContent, setClipContent] = useState('');
  const [clipSaving, setClipSaving] = useState(false);
  const [clipFetching, setClipFetching] = useState(false);
  const [clipFetchError, setClipFetchError] = useState('');
  const [clipModalOpen, setClipModalOpen] = useState(false);
  const [shelfFilter, setShelfFilter] = useState<'all' | Status>('all');
  const [personalShelfFilter, setPersonalShelfFilter] = useState<'all' | Status>('all');
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const handleDraftChange = useCallback((reviewId: string, d: DraftRow | null) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (d) next[reviewId] = d;
      else delete next[reviewId];
      return next;
    });
  }, []);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [noteDraftText, setNoteDraftText] = useState('');
  const articleRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState({ nickname: '', sealText: '', sealColor: 'ink', sealStyle: 'solid', sealImage: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [pendingImage, setPendingImage] = useState<Blob | null>(null);
  const [cropSource, setCropSource] = useState<HTMLCanvasElement | null>(null);
  const [sealImageBroken, setSealImageBroken] = useState(false);
  useEffect(() => {
    setSealImageBroken(false);
  }, [draft.sealImage]);

  useEffect(() => {
    if (!clipModalOpen && !bookModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setClipModalOpen(false);
        setBookModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clipModalOpen, bookModalOpen]);

  const navIdx = useRef(0);

  const applyNav = useCallback((n: NavState) => {
    setTab(n.tab);
    setActiveId(n.activeId);
    setActiveSeries(n.activeSeries);
    setActiveClipId(n.activeClipId);
    setSelection(null);
    setNotePanelOpen(false);
    setIsEditingContent(false);
    setNewQuoteInput('');
  }, []);

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, rp: true, idx: 0, nav: NAV_DEFAULT }, '');
    navIdx.current = 0;

    const onPop = (e: PopStateEvent) => {
      const st = e.state as { rp?: boolean; idx?: number; nav?: NavState; scroll?: number } | null;
      if (st?.rp && st.nav) {
        navIdx.current = st.idx ?? 0;
        applyNav(st.nav);
        setTimeout(() => window.scrollTo(0, st.scroll ?? 0), 50);
      } else {
        navIdx.current = 0;
        applyNav(NAV_DEFAULT);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyNav]);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })
    );
  }, []);

  const profileOf = (userId: string) => {
    const p = profiles[userId];
    const nickname =
      p?.nickname || (user && userId === user.id ? (user.email || '나').split('@')[0] : '알 수 없음');
    return {
      nickname,
      seal_text: p?.seal_text || Array.from(nickname)[0] || '?',
      seal_color: p?.seal_color || 'ink',
      seal_style: p?.seal_style || 'solid',
      seal_image: p?.seal_image || '',
    };
  };
  const nameOf = (userId: string) => profileOf(userId).nickname;

  const shelfEntries = useMemo(() => buildShelfEntries(allReviews), [allReviews]);

  const myReviews = allReviews.filter((r) => r.user_id === user?.id);
  const activeReview = allReviews.find((r) => r.id === activeId) ?? null;
  const activeClip = clippings.find((c) => c.id === activeClipId) ?? null;
  const isOwner = !!activeReview && activeReview.user_id === user?.id;
  const otherReviews = activeReview
    ? allReviews.filter((r) => r.book_isbn === activeReview.book_isbn && r.id !== activeReview.id)
    : [];

  const loadData = useCallback(async (u: User) => {
    const reviewSelect = (withJson: boolean) =>
      supabase
        .from('reviews')
        .select(
          `id, user_id, book_isbn, rating, status, content, ${withJson ? 'content_json, ' : ''}created_at, books(title, author, cover_url), quotes(id, content, created_at, quote_comments(id, content, created_at))`
        )
        .order('created_at', { ascending: false });
    let reviewsRes = await reviewSelect(true);
    if (reviewsRes.error) reviewsRes = await reviewSelect(false);

    const queryProfiles = async (cols: string) =>
      (await supabase.from('profiles').select(cols)) as unknown as ProfilesResult;
    let profilesRes = await queryProfiles('id, nickname, seal_text, seal_color, seal_style, seal_image');
    if (profilesRes.error) {
      profilesRes = await queryProfiles('id, nickname, seal_text, seal_color, seal_style');
    }
    if (profilesRes.error) {
      profilesRes = await queryProfiles('id, nickname');
    }

    if (reviewsRes.error) console.error('reviews 에러:', reviewsRes.error.message);
    if (profilesRes.error) console.error('profiles 에러:', profilesRes.error.message);

    const map: Record<string, Profile> = {};
    (profilesRes.data || []).forEach((p) => {
      map[p.id] = {
        nickname: p.nickname,
        seal_text: p.seal_text ?? null,
        seal_color: p.seal_color ?? null,
        seal_style: p.seal_style ?? null,
        seal_image: p.seal_image ?? null,
      };
    });

    if (!profilesRes.error && !map[u.id]) {
      const nick = (u.email || '사용자').split('@')[0];
      await supabase
        .from('profiles')
        .upsert({ id: u.id, nickname: nick }, { onConflict: 'id', ignoreDuplicates: true });
      map[u.id] = { nickname: nick, seal_text: null, seal_color: null, seal_style: null, seal_image: null };
    }
    setProfiles(map);

    const draftsRes = await supabase
      .from('review_drafts')
      .select('review_id, content_json, content_text, updated_at')
      .eq('user_id', u.id);
    if (draftsRes.error) {
      console.error('review_drafts 에러:', draftsRes.error.message);
    } else {
      setDrafts(Object.fromEntries(((draftsRes.data as unknown as DraftRow[]) || []).map((d) => [d.review_id, d])));
    }

    const clipRes = await supabase
      .from('clippings')
      .select(
        'id, title, source, content, created_at, clip_highlights(id, start_offset, end_offset, color, created_at), clip_notes(id, start_offset, end_offset, quote_text, content, created_at)'
      )
      .eq('user_id', u.id)
      .order('created_at', { ascending: false });
    if (clipRes.error) {
      console.error('clippings 에러:', clipRes.error.message);
    } else {
      setClippings(
        (clipRes.data as unknown as Clipping[]).map((c) => ({
          ...c,
          clip_highlights: [...(c.clip_highlights || [])].sort(byCreated),
          clip_notes: [...(c.clip_notes || [])].sort(byCreated),
        }))
      );
    }

    if (!reviewsRes.error && reviewsRes.data) {
      const normalized: Review[] = (reviewsRes.data as unknown as Review[])
        .filter((r) => r.books)
        .map((r) => ({
          ...r,
          rating: Number(r.rating) || 0,
          quotes: (r.quotes || [])
            .map((q) => ({
              ...q,
              quote_comments: [...(q.quote_comments || [])].sort(byCreated),
            }))
            .sort(byCreated),
        }));
      setAllReviews(normalized);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (user) await loadData(user);
  }, [user, loadData]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadData(session.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadData(session.user);
    });

    return () => subscription.unsubscribe();
  }, [loadData]);

  useEffect(() => {
    if (!activeClip) return;
    const content = activeClip.content;

    const onChange = () => {
      const sel = window.getSelection();
      const container = articleRef.current;
      if (!sel || !container || sel.rangeCount === 0 || sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      const inStart = container.contains(range.startContainer);
      const inEnd = container.contains(range.endContainer);
      if (!inStart && !inEnd) return;

      let s = inStart ? measureOffset(container, range.startContainer, range.startOffset) : 0;
      let e = inEnd ? measureOffset(container, range.endContainer, range.endOffset) : content.length;
      if (e < s) [s, e] = [e, s];
      while (s < e && /\s/.test(content[s])) s++;
      while (e > s && /\s/.test(content[e - 1])) e--;
      if (e <= s) return;

      setSelection((prev) =>
        prev && prev.start === s && prev.end === e ? prev : { start: s, end: e, text: content.slice(s, e) }
      );
    };

    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, [activeClip]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('이메일과 비밀번호를 입력해 주세요.');

    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('회원가입이 완료되었습니다! 로그인해 주세요.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      alert(`인증 에러: ${errMsg(err)}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAllReviews([]);
    setClippings([]);
    applyNav(NAV_DEFAULT);
  };

  const handlePickSealImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('이미지 파일만 올릴 수 있어요.');
    if (file.size > 10 * 1024 * 1024) return alert('10MB 이하의 사진을 골라 주세요.');

    try {
      setCropSource(await loadOrientedCanvas(file));
    } catch (err) {
      alert(errMsg(err) || '이미지를 처리하지 못했어요.');
    }
  };

  const handleCropConfirm = (blob: Blob) => {
    if (draft.sealImage.startsWith('blob:')) URL.revokeObjectURL(draft.sealImage);
    setPendingImage(blob);
    setDraft({ ...draft, sealImage: URL.createObjectURL(blob) });
    setCropSource(null);
    setProfileMsg('');
  };

  const handleRemoveSealImage = () => {
    if (draft.sealImage.startsWith('blob:')) URL.revokeObjectURL(draft.sealImage);
    setPendingImage(null);
    setDraft({ ...draft, sealImage: '' });
    setProfileMsg('');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileMsg('');

    const nick = draft.nickname.trim();
    if (!nick) return alert('닉네임을 입력해 주세요.');
    if (Array.from(nick).length > 16) return alert('닉네임은 16자 이내로 입력해 주세요.');

    const taken = Object.entries(profiles).some(
      ([id, p]) => id !== user.id && p.nickname.toLowerCase() === nick.toLowerCase()
    );
    if (taken) return alert('이미 사용 중인 닉네임이에요.');

    const sealText = Array.from(draft.sealText.trim()).slice(0, 2).join('');
    const oldImage = profiles[user.id]?.seal_image || '';
    const imageChanged = !!pendingImage || draft.sealImage !== oldImage;

    setProfileSaving(true);

    let newImageUrl = '';
    let newPath = '';
    if (pendingImage) {
      newPath = `${user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('seals')
        .upload(newPath, pendingImage, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (upErr) {
        setProfileSaving(false);
        return alert(
          `사진 올리기 실패: ${upErr.message}\nSupabase에서 안내드린 SQL로 'seals' 저장소를 먼저 만들어 주세요.`
        );
      }
      newImageUrl = supabase.storage.from('seals').getPublicUrl(newPath).data.publicUrl;
    }

    const payload: Record<string, string | null> = {
      id: user.id,
      nickname: nick,
      seal_text: sealText || null,
      seal_color: draft.sealColor,
      seal_style: draft.sealStyle,
    };
    if (imageChanged) payload.seal_image = pendingImage ? newImageUrl : draft.sealImage || null;

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    setProfileSaving(false);

    if (error) {
      if (newPath) await supabase.storage.from('seals').remove([newPath]);
      if (error.message.includes('seal_')) {
        return alert('인장 저장에 필요한 컬럼이 아직 없어요. Supabase에서 안내드린 SQL을 먼저 실행해 주세요.');
      }
      return alert(`프로필 저장 실패: ${error.message}`);
    }

    if (imageChanged && oldImage) {
      const oldPath = sealPathFromUrl(oldImage, user.id);
      if (oldPath) await supabase.storage.from('seals').remove([oldPath]);
    }

    if (pendingImage) {
      if (draft.sealImage.startsWith('blob:')) URL.revokeObjectURL(draft.sealImage);
      setDraft((d) => ({ ...d, sealImage: newImageUrl }));
      setPendingImage(null);
    }
    await refresh();
    setProfileMsg(pendingImage ? '사진까지 저장했어요.' : '저장했어요.');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/books/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.documents || []);
    } catch {
      alert('책 검색 실패');
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchResults([]);
    setSelectedBook(null);
    setQuery('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !user) return;

    const isbnList = selectedBook.isbn.trim().split(' ');
    const primaryIsbn = isbnList[isbnList.length - 1] || selectedBook.isbn;

    try {
      const { data: dup } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', user.id)
        .eq('book_isbn', primaryIsbn)
        .maybeSingle();

      if (dup) {
        alert('이미 서재에 있는 책이에요. 해당 글로 이동할게요.');
        setSelectedBook(null);
        setBookModalOpen(false);
        navigate({ tab: 'mine', activeId: dup.id });
        return;
      }

      const { error: bookError } = await supabase.from('books').upsert({
        isbn: primaryIsbn,
        title: selectedBook.title,
        author: selectedBook.authors.join(', '),
        publisher: selectedBook.publisher,
        cover_url: selectedBook.thumbnail,
      });
      if (bookError) throw bookError;

      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          book_isbn: primaryIsbn,
          rating: regStatus === 'completed' ? rating : 0,
          status: regStatus,
          content: '',
        })
        .select()
        .single();
      if (reviewError) throw reviewError;

      setSelectedBook(null);
      setBookModalOpen(false);
      setRating(0);
      setRegStatus('completed');
      setSearchResults([]);
      setQuery('');
      await loadData(user);

      navigate({ tab: 'mine', activeId: reviewData.id });
    } catch (err) {
      alert(`저장 실패: ${errMsg(err)}`);
    }
  };

  const handleUpdateStatus = async (
    nextStatus: Status,
    nextRating: number,
    target: Review | null = activeReview
  ) => {
    if (!target || !user || target.user_id !== user.id) return;
    const savedRating = nextStatus === 'completed' ? nextRating : 0;

    setAllReviews((prev) =>
      prev.map((r) =>
        r.id === target.id ? { ...r, status: nextStatus, rating: savedRating } : r
      )
    );

    const { error } = await supabase
      .from('reviews')
      .update({ status: nextStatus, rating: savedRating })
      .eq('id', target.id)
      .eq('user_id', user.id);

    if (error) {
      alert(`저장 실패: ${error.message}`);
      refresh();
    }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReview || !user || !isOwner || !newQuoteInput.trim()) return;

    try {
      const { error } = await supabase.from('quotes').insert({
        review_id: activeReview.id,
        user_id: user.id,
        content: newQuoteInput.trim(),
      });
      if (error) throw error;
      setNewQuoteInput('');
      refresh();
    } catch (err) {
      alert(`인용문 추가 실패: ${errMsg(err)}`);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('이 인용문을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
      if (error) throw error;
      refresh();
    } catch (err) {
      alert(`삭제 실패: ${errMsg(err)}`);
    }
  };

  const handleAddComment = async (quoteId: string, text: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('quote_comments')
      .insert({ quote_id: quoteId, user_id: user.id, content: text });
    if (error) {
      alert(`코멘트 추가 실패: ${error.message}`);
      return false;
    }
    await refresh();
    return true;
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('이 코멘트를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('quote_comments').delete().eq('id', commentId);
    if (error) return alert(`코멘트 삭제 실패: ${error.message}`);
    refresh();
  };

  const startWritingReview = () => {
    setIsEditingContent(true);
    setTimeout(() => {
      document.getElementById('review-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('이 책과 관련된 모든 기록(인용문 포함)을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) throw error;
      goBack();
      refresh();
    } catch (err) {
      alert(`삭제 실패: ${errMsg(err)}`);
    }
  };

  const openClip = (id: string) => {
    navigate({ tab: 'scraps', activeId: null, activeSeries: null, activeClipId: id });
    setNoteDraftText('');
    window.scrollTo({ top: 0 });
  };

  const handleSaveClipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const body = clipContent.replace(/\r\n/g, '\n').trim();
    if (!body) return alert('본문을 붙여넣어 주세요.');
    const title = clipTitle.trim() || body.split('\n')[0].slice(0, 40);

    setClipSaving(true);
    const { data, error } = await supabase
      .from('clippings')
      .insert({ user_id: user.id, title, source: clipSource.trim() || null, content: body })
      .select('id')
      .single();
    setClipSaving(false);

    if (error) return alert(`스크랩 저장 실패: ${error.message}`);
    setClipTitle('');
    setClipSource('');
    setClipContent('');
    setClipFetchError('');
    setClipModalOpen(false);
    await refresh();
    openClip(data.id);
  };

  const fetchArticle = async (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setClipFetchError('http:// 또는 https:// 로 시작하는 링크를 넣어 주세요.');
      return;
    }
    setClipFetching(true);
    setClipFetchError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/clips/fetch?url=${encodeURIComponent(url)}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '본문을 불러오지 못했어요.');

      setClipTitle((prev) => (prev.trim() ? prev : data.title || ''));
      setClipContent(data.content || '');
      setClipSource(data.finalUrl || url);
    } catch (err) {
      setClipFetchError(`${errMsg(err)} 본문을 직접 붙여넣어 주세요.`);
    } finally {
      setClipFetching(false);
    }
  };

  const handleClipLinkPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').trim();
    if (/^https?:\/\/\S+$/i.test(text) && !clipContent.trim()) {
      setTimeout(() => fetchArticle(text), 0);
    }
  };

  const clearSelection = () => {
    setSelection(null);
    setNotePanelOpen(false);
    window.getSelection()?.removeAllRanges();
  };

  const applyHighlight = async (color: 'red' | 'blue' | 'erase') => {
    if (!activeClip || !user || !selection) return;
    const { data, error } = await supabase
      .from('clip_highlights')
      .insert({
        clipping_id: activeClip.id,
        user_id: user.id,
        start_offset: selection.start,
        end_offset: selection.end,
        color,
      })
      .select('id, start_offset, end_offset, color, created_at')
      .single();
    if (error) return alert(`형광펜 저장 실패: ${error.message}`);

    setClippings((prev) =>
      prev.map((c) =>
        c.id === activeClip.id ? { ...c, clip_highlights: [...c.clip_highlights, data as ClipHighlight] } : c
      )
    );
    clearSelection();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClip || !user || !selection) return;
    const text = noteDraftText.trim();
    if (!text) return;

    const { data, error } = await supabase
      .from('clip_notes')
      .insert({
        clipping_id: activeClip.id,
        user_id: user.id,
        start_offset: selection.start,
        end_offset: selection.end,
        quote_text: selection.text,
        content: text,
      })
      .select('id, start_offset, end_offset, quote_text, content, created_at')
      .single();
    if (error) return alert(`코멘트 저장 실패: ${error.message}`);

    setClippings((prev) =>
      prev.map((c) =>
        c.id === activeClip.id ? { ...c, clip_notes: [...c.clip_notes, data as ClipNote] } : c
      )
    );
    setNoteDraftText('');
    clearSelection();
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!activeClip || !confirm('이 코멘트를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('clip_notes').delete().eq('id', noteId);
    if (error) return alert(`삭제 실패: ${error.message}`);
    setClippings((prev) =>
      prev.map((c) =>
        c.id === activeClip.id ? { ...c, clip_notes: c.clip_notes.filter((n) => n.id !== noteId) } : c
      )
    );
  };

  const handleDeleteClipping = async () => {
    if (!activeClip || !confirm('이 스크랩과 형광펜, 코멘트를 모두 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('clippings').delete().eq('id', activeClip.id);
    if (error) return alert(`삭제 실패: ${error.message}`);
    goBack();
    clearSelection();
    refresh();
  };

  const navigate = (patch: Partial<NavState>, replace = false) => {
    const next: NavState = { tab, activeId, activeSeries, activeClipId, ...patch };
    const same =
      next.tab === tab &&
      next.activeId === activeId &&
      next.activeSeries === activeSeries &&
      next.activeClipId === activeClipId;

    if (!same) {
      if (replace) {
        window.history.replaceState({ ...window.history.state, rp: true, idx: navIdx.current, nav: next }, '');
      } else {
        window.history.replaceState({ ...window.history.state, scroll: window.scrollY }, '');
        navIdx.current += 1;
        window.history.pushState({ rp: true, idx: navIdx.current, nav: next }, '');
      }
    }
    applyNav(next);
  };

  const goBack = () => {
    if (navIdx.current > 0) window.history.back();
    else navigate({ activeId: null, activeSeries: null, activeClipId: null }, true);
  };

  const openReview = (rev: Review) => {
    navigate({ activeId: rev.id });
    window.scrollTo({ top: 0 });
  };

  const goTab = (t: Tab) => {
    navigate({ tab: t, activeId: null, activeSeries: null, activeClipId: null });
    setBoardFilter('');
    if (t === 'profile' && user) {
      const p = profiles[user.id];
      setDraft({
        nickname: profileOf(user.id).nickname,
        sealText: p?.seal_text ?? '',
        sealColor: p?.seal_color || 'ink',
        sealStyle: p?.seal_style || 'solid',
        sealImage: p?.seal_image ?? '',
      });
      setPendingImage(null);
      setCropSource(null);
      setProfileMsg('');
    }
  };

  const matchesFilter = (r: Review) => {
    const q = boardFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      r.books.title.toLowerCase().includes(q) ||
      r.books.author.toLowerCase().includes(q) ||
      nameOf(r.user_id).toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q) ||
      (r.quotes || []).some((x) => x.content.toLowerCase().includes(q))
    );
  };

  if (!user) {
    return (
      <main>
        
        <div>
          <h1>
            독-서팟
          </h1>
          {isSignUp && (
            <p>
              새로운 계정 생성하기
            </p>
          )}

          <form onSubmit={handleAuth}>
            <div>
              <label>이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
              />
            </div>

            <div>
              <label>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자리 이상 비밀번호"
                required
              />
            </div>

            <button type="submit" disabled={authLoading}>
              {authLoading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
            </button>
          </form>

          <div>
            <button onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const renderByline = (userId: string, size = 18) => {
    const p = profileOf(userId);
    return (
      <span>
        <Seal text={p.seal_text} color={p.seal_color} styleType={p.seal_style} image={p.seal_image} size={size} />
        <span>{p.nickname}</span>
      </span>
    );
  };

  const writtenAll = allReviews.filter((r) => r.content.trim());
  const pad2 = (n: number) => String(n).padStart(2, '0');

  const navItem = (t: Tab, label: string, count?: number) => (
    <button
      key={t}
      type="button"
      onClick={() => { goTab(t); setMobileNavOpen(false); }}
      aria-current={tab === t ? 'page' : undefined}
    >
      <span>{label}</span>
      {count !== undefined && tab === t && <span>{count}</span>}
    </button>
  );

  const boardSearch = (
    <div>
      <span aria-hidden="true">⌕</span>
      <input
        id="archive-search"
        type="search"
        value={boardFilter}
        onChange={(e) => setBoardFilter(e.target.value)}
        placeholder="책 제목 또는 저자 검색"
        aria-label="책 제목 또는 저자 검색"
      />
      {boardFilter && (
        <button
          type="button"
          onClick={() => setBoardFilter('')}
          aria-label="검색어 지우기"
          title="검색어 지우기"
        >×</button>
      )}
    </div>
  );

  const header = (
    <>
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside>
        <div>
          <div>독-<br />서팟</div>
          <button
            type="button"
            aria-label="메뉴 닫기"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav aria-label="주 메뉴">
          {navItem('shelf', '서고', shelfEntries.length)}
          {navItem('mine', '책장')}
          {navItem('scraps', '스크랩북')}
        </nav>
        <div />
        <div>
          <button
            type="button"
            onClick={() => { goTab('profile'); setMobileNavOpen(false); }}
            aria-label="프로필 설정"
            title="프로필 설정"
          >
            <Seal
              text={profileOf(user.id).seal_text}
              color={profileOf(user.id).seal_color}
              styleType={profileOf(user.id).seal_style}
              image={profileOf(user.id).seal_image}
              size={31}
            />
            <span>{profileOf(user.id).nickname}</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 1.8-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-2.55v-.11a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-1.8-1.8.06-.06A1.7 1.7 0 0 0 8.17 15a1.7 1.7 0 0 0-1.55-1H6.5v-2.55h.12a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.8-1.8.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V5.5h2.55v.12a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.8 1.8-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.55 1h.12v2.55h-.12a1.7 1.7 0 0 0-1.55 1Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="로그아웃"
            title="로그아웃"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 17l5-5-5-5M15 12H3" />
              <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );


  const pickReview = (v: SeriesVolume) => v.reviews.find((r) => r.user_id === user.id) ?? v.reviews[0];

  const openSeries = (entry: SeriesEntry) => {
    const vol = entry.volumes[0];
    navigate({ activeSeries: entry.key, activeId: pickReview(vol).id });
    window.scrollTo({ top: 0 });
  };

  const openVolume = (vol: SeriesVolume) => {
    navigate({ activeId: pickReview(vol).id }, true);
    window.scrollTo({ top: 0 });
  };


  if (activeReview) {
    const hasQuotes = (activeReview.quotes?.length || 0) > 0;
      const showQuotes = isOwner || hasQuotes;
    const sameBookReviews = allReviews.filter((r) => r.book_isbn === activeReview.book_isbn);
    const myBookReview = sameBookReviews.find((r) => r.user_id === user.id) ?? null;
    const ratingReviews = sameBookReviews.filter(
      (r) => r.status === 'completed' && (r.rating > 0 || r.id === myBookReview?.id)
    );
    const readers = otherReviews.filter((r) => r.status !== 'wishlist');
    const hasSidebar = readers.length > 0;
    const seriesEntry = activeSeries
      ? buildCommunityEntries(allReviews).find(
          (e): e is SeriesEntry => e.type === 'series' && e.key === activeSeries
        )
      : undefined;

    return (
      <div>
        
        {header}
        <main>
          <article>
            <section>
              <div>
                <img
                  src={activeReview.books.cover_url || undefined}
                  alt={activeReview.books.title}
                />
                <div>
                  <div>
                    <div>
                      <p>
                        {renderByline(activeReview.user_id, 20)}
                        <span>&middot; {new Date(activeReview.created_at).toLocaleDateString('ko-KR')}</span>
                      </p>
                      <h2>
                        {activeReview.books.title}
                      </h2>
                      <p>{activeReview.books.author}</p>
                      {seriesEntry && (
                        <div aria-label="시리즈 권 선택">
                          {seriesEntry.volumes.map((v) => (
                            <ToggleButton
                              key={v.volume}
                              pressed={v.reviews.some((r) => r.id === activeReview.id)}
                              onClick={() => openVolume(v)}
                            >
                              {v.label}
                            </ToggleButton>
                          ))}
                        </div>
                      )}
                      {!isOwner && <div><StatusCell review={activeReview} /></div>}
                    </div>

                    {isOwner && (
                      <div>
                        <ToggleButton
                          pressed={activeReview.status === 'reading'}
                          onClick={() =>
                            handleUpdateStatus(
                              activeReview.status === 'reading' ? 'completed' : 'reading',
                              activeReview.rating
                            )
                          }
                        >
                          읽는 중
                        </ToggleButton>
                        {!activeReview.content && !isEditingContent && (
                          <button onClick={startWritingReview}>
                            {drafts[activeReview.id] ? '이어서 쓰기' : '독후감 추가'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </section>

            <section>
              <h3>별점</h3>
              <div>
                {ratingReviews.length > 0 ? (
                  ratingReviews.map((r) => (
                    <div key={r.id}>
                      <span>{profileOf(r.user_id).nickname}</span>
                      {r.id === myBookReview?.id && r.status === 'completed' ? (
                        <RatingInput
                          value={r.rating}
                          onChange={(v) => handleUpdateStatus('completed', v, r)}
                          size={20}
                        />
                      ) : (
                        <RatingDisplay value={r.rating} size={15} />
                      )}
                      <strong>{r.rating.toFixed(1)}</strong>
                    </div>
                  ))
                ) : (
                  <p>아직 등록된 별점이 없어요.</p>
                )}
              </div>
            </section>

            <div>
              <div>
                {showQuotes && (
                  <section>
                    <h3>
                      인용문{' '}
                      <span>
                        ({activeReview.quotes?.length || 0})
                      </span>
                    </h3>
                    {isOwner && hasQuotes && (
                      <p>인용문을 누르면 코멘트를 달 수 있어요.</p>
                    )}

                    <div>
                      {hasQuotes ? (
                        <QuoteList
                          quotes={activeReview.quotes!}
                          isOwner={isOwner}
                          onDeleteQuote={isOwner ? handleDeleteQuote : undefined}
                          onAddComment={isOwner ? handleAddComment : undefined}
                          onDeleteComment={isOwner ? handleDeleteComment : undefined}
                        />
                      ) : (
                        <p>아직 추가된 인용문이 없습니다.</p>
                      )}
                    </div>

                    {isOwner && (
                      <form
                        onSubmit={handleAddQuote}
                      >
                        <div>
                          <label>새 인용문</label>
                          <textarea
                            rows={2}
                            value={newQuoteInput}
                            onChange={(e) => setNewQuoteInput(e.target.value)}
                            placeholder="마음에 남은 문장을 적어 보세요"
                          />
                        </div>
                        <button type="submit">
                          추가
                        </button>
                      </form>
                    )}
                  </section>
                )}

                {isEditingContent && isOwner ? (
                  <section id="review-editor">
                    <h3>독후감</h3>
                    <ReviewEditorPanel
                      key={activeReview.id}
                      review={activeReview}
                      userId={user.id}
                      draft={drafts[activeReview.id] ?? null}
                      onDraftChange={handleDraftChange}
                      onDone={(published) => {
                        setIsEditingContent(false);
                        if (published) refresh();
                      }}
                    />
                  </section>
                ) : activeReview.content ? (
                  <section>
                    <div>
                      <h3>독후감</h3>
                      {isOwner && (
                        <div>
                          {drafts[activeReview.id] && <span>임시 저장본 있음</span>}
                          <button onClick={() => setIsEditingContent(true)}>
                            {drafts[activeReview.id] ? '이어서 쓰기' : '수정하기'}
                          </button>
                        </div>
                      )}
                    </div>
                    <ReviewBody review={activeReview} />
                  </section>
                ) : isOwner && drafts[activeReview.id] ? (
                  <section>
                    <div>
                      <h3>독후감</h3>
                      <span>임시 저장</span>
                    </div>
                    <p>
                      아직 발행하지 않은 글이 임시 저장되어 있어요. 나만 볼 수 있어요.
                    </p>
                    <button onClick={() => setIsEditingContent(true)}>
                      이어서 쓰기
                    </button>
                  </section>
                ) : null}
              </div>

              {hasSidebar && (
                <aside>
                  <div>
                    <h3>
                      같은 책을 읽은 사람{' '}
                      <span>({readers.length})</span>
                    </h3>
                    <ToggleButton pressed={showOthers} onClick={() => setShowOthers(!showOthers)}>
                      함께 보기
                    </ToggleButton>
                  </div>

                  {showOthers &&
                    readers.map((o) => (
                      <div key={o.id}>
                        <div>
                          <span>{renderByline(o.user_id, 22)}</span>
                          <StatusCell review={o} size={14} />
                        </div>

                        {o.quotes && o.quotes.length > 0 && <QuoteList quotes={o.quotes} />}

                        {o.content && (
                          <div>
                            <p>독후감</p>
                            <ReviewBody review={o} />
                          </div>
                        )}

                        {(!o.quotes || o.quotes.length === 0) && !o.content && (
                          <p>아직 남긴 기록이 없어요.</p>
                        )}
                      </div>
                    ))}
                </aside>
              )}
            </div>

            <div>
              {isOwner ? (
                <button onClick={() => handleDeleteReview(activeReview.id)}>
                  이 책 서재에서 삭제
                </button>
              ) : (
                <span />
              )}
              <button onClick={goBack}>
                목록으로
              </button>
            </div>
          </article>
        </main>
      </div>
    );
  }

  if (activeClip) {
    const notes = sortNotes(activeClip.clip_notes);
    const isUrl = !!activeClip.source && /^https?:\/\//i.test(activeClip.source);
    const swatches: { key: 'red' | 'blue' | 'erase'; label: string; color: string }[] = [
      { key: 'red', label: '빨강', color: 'rgba(230, 45, 70, 0.58)' },
      { key: 'blue', label: '파랑', color: 'rgba(45, 125, 235, 0.56)' },
      { key: 'erase', label: '지우개', color: '#FFFFFF' },
    ];
    const keepSelection = (e: React.MouseEvent) => e.preventDefault();


    const noteForm = (variant: 'side' | 'bar') =>
      selection && notePanelOpen ? (
        <form
          onSubmit={handleAddNote}
        >
          {variant === 'bar' && (
            <p>
              &quot;{selection.text}&quot;
            </p>
          )}
          {variant === 'side' ? (
            <textarea
              rows={3}
              autoFocus
              value={noteDraftText}
              onChange={(e) => setNoteDraftText(e.target.value)}
              placeholder="이 문장에 대한 의견을 적어 보세요"
            />
          ) : (
            <input
              type="text"
              autoFocus
              value={noteDraftText}
              onChange={(e) => setNoteDraftText(e.target.value)}
              placeholder="이 문장에 대한 의견"
            />
          )}
          <div>
            <button type="submit">
              등록
            </button>
            <button
              type="button"
              onClick={() => setNotePanelOpen(false)}
            >
              취소
            </button>
          </div>
        </form>
      ) : null;

    return (
      <div>
        
        {header}
        <main>
          <button
            onClick={goBack}
          >
            &larr; 스크랩북으로 돌아가기
          </button>

          <div>
            <article>
              <section>
                <h2>
                  {activeClip.title}
                </h2>
                <p>
                  {activeClip.source &&
                    (isUrl ? (
                      <a
                        href={activeClip.source}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        {activeClip.source}
                      </a>
                    ) : (
                      <span>{activeClip.source}</span>
                    ))}
                  <span>{new Date(activeClip.created_at).toLocaleDateString('ko-KR')}</span>
                </p>
                <div>
                  <button onClick={handleDeleteClipping}>
                    스크랩 삭제
                  </button>
                </div>
              </section>

              <section>
                <ClipArticle
                  content={activeClip.content}
                  highlights={activeClip.clip_highlights}
                  notes={activeClip.clip_notes}
                  containerRef={articleRef}
                />
              </section>

              {activeClip.clip_highlights.length > 0 && (
                <section>
                  <div>
                    <h3>
                      형광펜 <span>({activeClip.clip_highlights.length})</span>
                    </h3>
                  </div>
                  <div>
                    {[...activeClip.clip_highlights].sort(byCreated).map((h) => {
                      const excerpt = activeClip.content.slice(h.start_offset, h.end_offset).trim() || '선택한 문장';
                      return (
                        <div key={h.id}>
                          <span aria-hidden="true" />
                          <p>{excerpt}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {notes.length > 0 && (
                <section>
                  <h3>
                    각주{' '}
                    <span>({notes.length})</span>
                  </h3>
                  <div>
                    {notes.map((n, i) => (
                      <div key={n.id} id={`note-${n.id}`}>
                        <div>
                          <div>
                            <span>{i + 1})</span>
                            &quot;{n.quote_text}&quot;
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(n.id)}
                            aria-label="각주 삭제"
                            title="각주 삭제"
                          >
                            ×
                          </button>
                        </div>
                        <div>
                          <ReplyIcon />
                          <DiscordText text={n.content} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </article>

            <aside>
              <div>
                <div>
                  도구
                </div>
                <div>
                  <div>
                    <p>형광펜</p>
                    <div>
                      {swatches.map((b) => (
                        <button
                          key={b.key}
                          type="button"
                          disabled={!selection}
                          onMouseDown={keepSelection}
                          onClick={() => applyHighlight(b.key)}
                        >
                          <span
                          />
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p>선택한 문장</p>
                    <p>
                      {selection ? `"${selection.text}"` : '문장을 드래그해서 선택하세요'}
                    </p>
                    {selection && (
                      <button type="button" onClick={clearSelection}>
                        선택 해제
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!selection}
                      onMouseDown={keepSelection}
                      onClick={() => setNotePanelOpen(true)}
                    >
                      코멘트 달기
                    </button>
                    {noteForm('side')}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>

        <div>
          {noteForm('bar')}
          <div>
            <span>
              {selection ? `선택: "${selection.text}"` : '문장을 드래그해서 선택하세요'}
            </span>
            {selection && (
              <button type="button" onClick={clearSelection}>
                해제
              </button>
            )}
          </div>
          <div>
            {swatches.map((b) => (
              <button
                key={b.key}
                type="button"
                disabled={!selection}
                onMouseDown={keepSelection}
                onClick={() => applyHighlight(b.key)}
              >
                <span />
                <span>{b.label}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={!selection}
              onMouseDown={keepSelection}
              onClick={() => setNotePanelOpen(true)}
            >
              <span>+</span>
              <span>코멘트</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'profile') {
    const previewNick = draft.nickname.trim() || '닉네임';
    const previewSeal =
      Array.from(draft.sealText.trim()).slice(0, 2).join('') || Array.from(previewNick)[0] || '?';

    return (
      <div>
        
        {header}
        <main>
          <div>
            <section>
              <div>
                <p>Profile</p>
                <h2>닉네임과 인장</h2>
              </div>

              <div>
                <label>닉네임</label>
                <input
                  type="text"
                  value={draft.nickname}
                  onChange={(e) =>
                    setDraft({ ...draft, nickname: Array.from(e.target.value).slice(0, 16).join('') })
                  }
                  placeholder="다른 사람에게 보이는 이름"
                />
                <p>
                  {Array.from(draft.nickname).length}/16 &middot; 다른 사람과 겹치면 쓸 수 없어요.
                </p>
              </div>

              <div>
                <label>인장 사진 (선택)</label>
                <div>
                  <Seal
                    text={previewSeal}
                    color={draft.sealColor}
                    styleType={draft.sealStyle}
                    image={draft.sealImage}
                    size={64}
                    onImageError={() => setSealImageBroken(true)}
                  />
                  <div>
                    <label
                    >
                      {draft.sealImage ? '사진 바꾸기' : '사진 올리기'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePickSealImage}
                      />
                    </label>
                    {draft.sealImage && (
                      <button type="button" onClick={handleRemoveSealImage}>
                        사진 빼기
                      </button>
                    )}
                  </div>
                </div>
                {cropSource && (
                  <SealCropper
                    source={cropSource}
                    sealColor={draft.sealColor}
                    onConfirm={handleCropConfirm}
                    onCancel={() => setCropSource(null)}
                  />
                )}
                {sealImageBroken && draft.sealImage.startsWith('http') && (
                  <p>
                    저장된 사진을 불러오지 못했어요. Supabase Storage의 seals 버킷이 Public(공개)인지 확인해 주세요.
                  </p>
                )}
                {draft.sealImage.startsWith('http') && (
                  <a
                    href={draft.sealImage}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    저장된 사진 주소 열어보기
                  </a>
                )}
                <p>
                  사진을 고르면 드래그하고 확대해서 보여줄 부분을 정할 수 있어요. 사진은 원래 색 그대로, 기울어진
                  도장 모양으로 보여요. 사진을 쓰면 인장 글자와 모양은 쓰이지 않고, 색은 테두리에만 쓰여요. 저장해야
                  올라가요.
                </p>
              </div>

              <div>
                <label>인장 글자</label>
                <input
                  type="text"
                  value={draft.sealText}
                  onChange={(e) =>
                    setDraft({ ...draft, sealText: Array.from(e.target.value).slice(0, 2).join('') })
                  }
                  placeholder="비우면 닉네임 첫 글자"
                />
                <p>1~2글자까지 새길 수 있어요.</p>
              </div>

              <div>
                <label>인장 색</label>
                <div>
                  {Object.entries(SEAL_COLORS).map(([key, c]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={draft.sealColor === key}
                      onClick={() => setDraft({ ...draft, sealColor: key })}
                    >
                      <span
                      />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label>인장 모양</label>
                <div>
                  {SEAL_STYLES.map(([key, label]) => (
                    <ToggleButton
                      key={key}
                      pressed={draft.sealStyle === key}
                      onClick={() => setDraft({ ...draft, sealStyle: key })}
                    >
                      {label}
                    </ToggleButton>
                  ))}
                </div>
              </div>

              <div>
                <button onClick={handleSaveProfile} disabled={profileSaving}>
                  {profileSaving ? '저장 중...' : '저장'}
                </button>
                {profileMsg && <span>{profileMsg}</span>}
                <button onClick={handleLogout}>
                  로그아웃
                </button>
              </div>
            </section>

            <section>
              <div>
                <p>Preview</p>
                <h2>미리보기</h2>
              </div>

              <div>
                <div>
                  <Seal
                    text={previewSeal}
                    color={draft.sealColor}
                    styleType={draft.sealStyle}
                    image={draft.sealImage}
                    size={88}
                  />
                  <div>
                    <p>Reader</p>
                    <p>{previewNick}</p>
                  </div>
                </div>

                <div>
                  <p>이렇게 보여요</p>
                  <div>
                    <span>
                      <Seal
                        text={previewSeal}
                        color={draft.sealColor}
                        styleType={draft.sealStyle}
                        image={draft.sealImage}
                        size={18}
                      />
                      {previewNick}
                    </span>
                    <span>
                      <Seal
                        text={previewSeal}
                        color={draft.sealColor}
                        styleType={draft.sealStyle}
                        image={draft.sealImage}
                        size={22}
                      />
                      <span>
                        {previewNick} &middot; {today}
                      </span>
                    </span>
                  </div>
                  <p>
                    인장은 전체 서재 목록, 글 상세 화면, 같은 책을 읽은 사람 목록에서 닉네임 옆에 찍혀요.
                  </p>
                </div>

              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const renderEntryRow = (r: Review) => (
    <article key={r.id} onClick={() => openReview(r)}>
      <BookCover title={r.books.title} author={r.books.author} src={r.books.cover_url} />
      <div>
        <div>{r.books.title}</div>
        <div>{excerptOf(r.content)}</div>
        <div>
          {renderByline(r.user_id, 16)}
          <i />
          <span>{fmtMD(r.created_at)}</span>
          {r.status === 'completed' && r.rating > 0 && (
            <>
              <i />
              <RatingDisplay value={r.rating} size={11} />
            </>
          )}
        </div>
      </div>
    </article>
  );

  const openBook = (e: ShelfEntry) => {
    if (e.type === 'series') return openSeries(e);
    const target = e.reviews.find((r) => r.user_id === user.id) ?? e.reviews[0];
    navigate({ activeId: target.id });
    window.scrollTo({ top: 0 });
  };

  const goWrite = () => {
    goTab('mine');
    setBookModalOpen(true);
  };

  if (tab === 'shelf') {
    const filterKey = shelfFilter;
    const entries = buildShelfEntries(allReviews.filter(matchesFilter));
    const statusOf = (e: ShelfEntry) => shelfStatusOf(e.reviews);
    const hasStatus = (e: ShelfEntry, s: Status) => e.reviews.some((r) => r.status === s);
    const visible = entries.filter((e) => filterKey === 'all' || hasStatus(e, filterKey));
    const books = shelfEntries;
    const countOf = (s: Status) => books.filter((e) => statusOf(e) === s).length;

    const filters: ['all' | Status, string, number][] = [
      ['all', '전체 서가', books.length],
      ['wishlist', '읽고 싶은 책', countOf('wishlist')],
      ['reading', '읽는 중', countOf('reading')],
      ['completed', '완독', countOf('completed')],
    ];

    return (
      <div>
        
        {header}
        <div>
          <div>
            <div>
              <h1>서고</h1>
            </div>
            <button onClick={goWrite} aria-label="기록 남기기">
              <span aria-hidden="true">＋</span><span>기록 남기기</span>
            </button>
          </div>
          {boardSearch}

          <div>
            <div>
              {filters.map(([key, label, n]) => (
                <button
                  key={key}
                  onClick={() => setShelfFilter(key)}
                >
                  {label} <span>{n}</span>
                </button>
              ))}
            </div>
            <div>{visible.length}권의 책</div>
          </div>

          <div>
            {visible.length === 0 ? (
              <div>
                <strong>이 서가에는 아직 책이 없어요.</strong>
                <span>다른 분류를 선택하거나 검색어를 바꿔 보세요.</span>
              </div>
            ) : (
              visible.map((e) => {
                const readingUsers = Array.from(
                  new Set(e.reviews.filter((r) => r.status === 'reading').map((r) => r.user_id))
                );
                const title = e.type === 'series' ? e.base : e.book.title;
                const author = e.type === 'series' ? e.author : e.book.author;
                const cover = e.type === 'series' ? e.cover : e.book.cover_url;
                const latestQuote = e.reviews
                  .flatMap((review) => (review.quotes || []).map((quote) => ({ quote, review })))
                  .sort((a, b) => b.quote.created_at.localeCompare(a.quote.created_at))[0];
                const ratedReviews = e.reviews.filter((review) => review.rating > 0);
                const averageRating = ratedReviews.length
                  ? ratedReviews.reduce((sum, review) => sum + review.rating, 0) / ratedReviews.length
                  : 0;
                return (
                  <article key={e.type === 'series' ? e.key : e.isbn} onClick={() => openBook(e)}>
                    <div>
                      <div>
                        <BookCover title={title} author={author} src={cover} />
                      </div>
                      <div>
                        <h3>{title}</h3>
                        <div>{author}</div>
                        {e.type === 'series' && (
                          <p>시리즈 · 전 {e.volumes.length}권</p>
                        )}
                        {ratedReviews.length > 0 && (
                          <div aria-label={`평점 ${averageRating.toFixed(1)}점`}>
                            <span aria-hidden="true">
                              {Array.from({ length: 5 }, (_, i) => (
                                <span key={i}>{i < Math.round(averageRating) ? '★' : '☆'}</span>
                              ))}
                            </span>
                            <span>
                              {averageRating.toFixed(1)} · {ratedReviews.length}명
                            </span>
                          </div>
                        )}
                        {latestQuote && (
                          <p>
                            “{plainText(latestQuote.quote.content)}”
                          </p>
                        )}
                        {readingUsers.length > 0 && (
                          <div aria-label="현재 읽는 사람">
                            {readingUsers.map((uid) => (
                              <span key={uid} title={nameOf(uid)}>
                                <Seal
                                  text={profileOf(uid).seal_text}
                                  color={profileOf(uid).seal_color}
                                  styleType={profileOf(uid).seal_style}
                                  image={profileOf(uid).seal_image}
                                  size={22}
                                />
                                <span>{nameOf(uid)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'reviews') {
    const list = writtenAll.filter(matchesFilter);
    return (
      <div>
        
        {header}
        <div>
          <div>
            <div>
              <div>INDEX OF REFLECTIONS</div>
              <h1>독후감 기록</h1>
              <p>
                책을 읽은 뒤 남겨 둔 생각들의 색인입니다.
                <br />
                책 이름이나 저자로 오래전에 적어 둔 문장을 찾아보세요.
              </p>
            </div>
            <button onClick={goWrite}>
              ✎ &nbsp; 독후감 쓰기
            </button>
          </div>
          <div>
            <div>
              <span>전체 기록 {pad2(writtenAll.length)}</span>
              <span>최신 기록부터 정리합니다.</span>
            </div>
          </div>
          <div>
            {list.length === 0 ? (
              <div>
                <strong>{writtenAll.length === 0 ? '아직 남긴 독후감이 없어요.' : '찾는 기록이 없어요.'}</strong>
                <span>{writtenAll.length === 0 ? '책 상세에서 “독후감 추가”를 눌러 시작해 보세요.' : '검색어를 바꿔 보세요.'}</span>
              </div>
            ) : (
              list.map(renderEntryRow)
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'scraps') {
    const filterQ = boardFilter.trim().toLowerCase();
    const clipList = clippings.filter(
      (c) => !filterQ || `${c.title} ${c.source || ''}`.toLowerCase().includes(filterQ)
    );

    return (
      <div>
        
        {header}
        <div>
          <div>
            <div>
              <h1>스크랩북</h1>
            </div>
            <button
              type="button"
              onClick={() => setClipModalOpen(true)}
            >
              <span aria-hidden="true">＋</span><span>스크랩 추가</span>
            </button>
          </div>

          <div>
            <div>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
                placeholder="스크랩 제목 또는 출처 검색"
                aria-label="스크랩 제목 또는 출처 검색"
              />
              {boardFilter && (
                <button
                  type="button"
                  onClick={() => setBoardFilter('')}
                  aria-label="검색어 지우기"
                >×</button>
              )}
            </div>
            <div>
              <strong>{clipList.length}</strong> / {clippings.length}개
            </div>
          </div>

          <div>
            {clipList.length === 0 ? (
              <div>
                <strong>{clippings.length === 0 ? '아직 스크랩이 없어요.' : '찾는 스크랩이 없어요.'}</strong>
                <span>{clippings.length === 0 ? '기사나 칼럼을 추가해 나만의 스크랩북을 만들어 보세요.' : '검색어를 바꿔 보세요.'}</span>
              </div>
            ) : (
              clipList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openClip(c.id)}
                >
                  <div>
                    <h2>{c.title}</h2>
                    <p>
                      {c.source && <><span>{c.source}</span><i>·</i></>}
                      <span>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                    </p>
                    <p>{excerptOf(c.content, 150)}</p>
                    <div>
                      <span>형광펜 {c.clip_highlights.filter((h) => h.color !== 'erase').length}</span>
                      <span>각주 {c.clip_notes.length}</span>
                    </div>
                  </div>
                  <span aria-hidden="true">↗</span>
                </button>
              ))
            )}
          </div>
        </div>

        {clipModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-clipping-title"
            onClick={() => setClipModalOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <div>
                <div>
                  <h2 id="new-clipping-title">스크랩 추가</h2>
                </div>
                <button type="button" onClick={() => setClipModalOpen(false)}>
                  닫기
                </button>
              </div>

              <form onSubmit={handleSaveClipping}>
                <div>
                  <label>기사 링크 (선택)</label>
                  <div>
                    <input
                      type="text"
                      inputMode="url"
                      value={clipSource}
                      onChange={(e) => setClipSource(e.target.value)}
                      onPaste={handleClipLinkPaste}
                      placeholder="링크를 붙여넣으면 본문을 불러와요"
                    />
                    <button
                      type="button"
                      onClick={() => fetchArticle(clipSource)}
                      disabled={clipFetching || !clipSource.trim()}
                    >
                      {clipFetching ? '불러오는 중' : '불러오기'}
                    </button>
                  </div>
                  {clipFetchError && (
                    <p>{clipFetchError}</p>
                  )}
                  <p>
                    링크 대신 매체 이름을 적어도 돼요. 일부 사이트는 불러오지 못할 수 있어요.
                  </p>
                </div>

                <div>
                  <label>제목</label>
                  <input
                    type="text"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    placeholder="비우면 본문 첫 줄을 제목으로 써요"
                  />
                </div>

                <div>
                  <label>본문</label>
                  <textarea
                    rows={12}
                    value={clipContent}
                    onChange={(e) => setClipContent(e.target.value)}
                    placeholder="기사나 칼럼을 복사해서 붙여넣어도 돼요"
                  />
                  <p>
                    저장한 뒤에는 본문을 고칠 수 없어요. 형광펜과 각주 위치가 어긋나기 때문이에요. 불필요한 부분은 저장 전에 지워 주세요.
                  </p>
                </div>

                <div>
                  <button type="button" onClick={() => setClipModalOpen(false)}>
                    취소
                  </button>
                  <button type="submit" disabled={clipSaving}>
                    {clipSaving ? '저장 중...' : '스크랩 저장'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const myBooks = myReviews.filter((r) => {
    const q = boardFilter.trim().toLowerCase();
    const matchesText = !q || r.books.title.toLowerCase().includes(q) || r.books.author.toLowerCase().includes(q);
    const matchesStatus = personalShelfFilter === 'all' || r.status === personalShelfFilter;
    return matchesText && matchesStatus;
  });
  const countMyStatus = (status: 'all' | Status) =>
    myReviews.filter((r) => status === 'all' || r.status === status).length;
  const personalFilters: ['all' | Status, string, number][] = [
    ['all', '전체', countMyStatus('all')],
    ['wishlist', '읽고 싶은 책', countMyStatus('wishlist')],
    ['reading', '읽는 중', countMyStatus('reading')],
    ['completed', '완독', countMyStatus('completed')],
  ];

  const closeBookModal = () => {
    setBookModalOpen(false);
    clearSearch();
    setRating(0);
    setRegStatus('completed');
  };

  return (
    <div>
      
      {header}
      <div>
        <div>
          <div>
            <h1>책장</h1>
          </div>
          <button type="button" onClick={() => setBookModalOpen(true)}>
            <span aria-hidden="true">＋</span><span>책 추가</span>
          </button>
        </div>
        {boardSearch}

        <div>
          <div>
            {personalFilters.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPersonalShelfFilter(key)}
              >
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
          <div>{myBooks.length}권</div>
        </div>

        <div>
          {myBooks.length === 0 ? (
            <div>
              <strong>{myReviews.length === 0 ? '책장에 아직 책이 없어요.' : '찾는 책이 없어요.'}</strong>
              <span>{myReviews.length === 0 ? '책 추가를 눌러 첫 책을 등록해 보세요.' : '검색어나 분류를 바꿔 보세요.'}</span>
            </div>
          ) : (
            myBooks.map((r) => (
              <button key={r.id} type="button" onClick={() => openReview(r)}>
                <div>
                  <BookCover title={r.books.title} author={r.books.author} src={r.books.cover_url} />
                </div>
                <div>
                  <h2>{r.books.title}</h2>
                  <p>{r.books.author}</p>
                  <div>
                    <span>{STATUS_LABEL[r.status]}</span>
                    {r.status === 'completed' && r.rating > 0 && (
                      <span>
                        <RatingDisplay value={r.rating} size={13} />
                        <strong>{r.rating.toFixed(1)}</strong>
                      </span>
                    )}
                  </div>
                  <span>등록 {new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <span aria-hidden="true">↗</span>
              </button>
            ))
          )}
        </div>
      </div>

      {bookModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-book-title"
          onClick={closeBookModal}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <div>
              <div>
                <p>NEW BOOK</p>
                <h2 id="new-book-title">책 추가</h2>
              </div>
              <button type="button" onClick={closeBookModal}>닫기</button>
            </div>

            <form onSubmit={handleSearch}>
              <label>책 제목 또는 저자</label>
              <div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="책 제목 또는 저자 검색..."
                  autoFocus
                />
                <button type="submit" disabled={searchLoading}>
                  {searchLoading ? '검색 중' : '검색'}
                </button>
              </div>
            </form>

            {searchResults.length > 0 && !selectedBook && (
              <div>
                <div>
                  <span>검색 결과 {searchResults.length}건</span>
                  <button type="button" onClick={clearSearch}>결과 지우기</button>
                </div>
                {searchResults.map((book, idx) => (
                  <div key={`${book.isbn}-${idx}`}>
                    <img src={book.thumbnail || undefined} alt={book.title} />
                    <div>
                      <p>{book.title}</p>
                      <p>{book.authors.join(', ')}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedBook(book)}>
                      선택
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedBook && (
              <div>
                <div>
                  <div>
                    <img src={selectedBook.thumbnail || undefined} alt={selectedBook.title} />
                    <div>
                      <p>{selectedBook.title}</p>
                      <p>{selectedBook.authors.join(', ')}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedBook(null)}>다시 선택</button>
                </div>

                <form onSubmit={handleSubmitReview}>
                  <div>
                    <ToggleButton
                      pressed={regStatus === 'wishlist'}
                      onClick={() => setRegStatus(regStatus === 'wishlist' ? 'completed' : 'wishlist')}
                    >
                      읽고 싶은 책
                    </ToggleButton>
                    <ToggleButton
                      pressed={regStatus === 'reading'}
                      onClick={() => setRegStatus(regStatus === 'reading' ? 'completed' : 'reading')}
                    >
                      읽는 중
                    </ToggleButton>
                  </div>

                  {regStatus === 'completed' && (
                    <div>
                      <label>별점</label>
                      <div><RatingInput value={rating} onChange={setRating} size={26} /></div>
                    </div>
                  )}

                  <div>
                    <button type="button" onClick={closeBookModal}>취소</button>
                    <button type="submit">
                      {regStatus === 'wishlist' ? '읽고 싶은 책에 담기' : '내 서재에 등록하기'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
