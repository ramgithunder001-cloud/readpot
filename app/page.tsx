'use client';

import { useState, useEffect, useCallback } from 'react';
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
  status: 'reading' | 'completed';
  created_at: string;
  books: {
    title: string;
    author: string;
    cover_url: string;
  };
  quotes?: QuoteItem[];
}

type Tab = 'mine' | 'community';

const byCreated = (a: { created_at: string }, b: { created_at: string }) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

/* ---------- Newsprint 디자인 토큰 ----------
   paper #F9F9F7 / ink #111111 / divider #E5E5E0 / accent #CC0000
   둥근 모서리 없음, 검은 1px 테두리, 입력칸은 아래 선만 */

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2';

// 기본 버튼: 검정 바탕, hover 시 흰 바탕으로 반전
const BTN = `inline-flex items-center justify-center min-h-[44px] px-5 border border-[#111111] bg-[#111111] text-[#F9F9F7] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-white hover:text-[#111111] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
// 보조 버튼: 테두리만, hover 시 검정으로 채워짐
const BTN_OUTLINE = `inline-flex items-center justify-center min-h-[44px] px-5 border border-[#111111] bg-transparent text-[#111111] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-[#111111] hover:text-[#F9F9F7] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
// 작은 버튼
const BTN_SM = `inline-flex items-center justify-center min-h-[36px] px-3 border border-[#111111] bg-[#111111] text-[#F9F9F7] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-white hover:text-[#111111] ${FOCUS}`;
// 텍스트 링크형 버튼: hover 시 빨간 밑줄
const LINK_BTN = `text-xs font-semibold tracking-widest text-[#111111] underline-offset-4 decoration-2 decoration-[#CC0000] hover:underline ${FOCUS}`;
// 지우기 같은 위험 동작
const DANGER_BTN = `text-xs text-[#737373] underline-offset-4 decoration-2 decoration-[#CC0000] hover:text-[#CC0000] hover:underline ${FOCUS}`;
// 입력칸: 아래 2px 선만
const INPUT = `w-full bg-transparent border-b-2 border-[#111111] px-1 py-2 text-sm placeholder:text-[#A3A3A3] focus:bg-[#F0F0F0] focus:outline-none`;
// 큰 입력 영역(독후감)
const TEXTAREA_BOX = `w-full bg-transparent border-2 border-[#111111] p-3 text-sm leading-relaxed placeholder:text-[#A3A3A3] focus:bg-[#F0F0F0] focus:outline-none`;
// 작은 대문자 라벨
const LABEL = 'block text-[11px] font-semibold uppercase tracking-widest text-[#111111]';

// 프리텐다드 폰트 + 신문지 질감 배경 + 직각 모서리
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
      body, body * {
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif !important;
      }
      body code, body pre, body pre * {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Pretendard', monospace !important;
      }
      body {
        color: #111111;
        background-color: #F9F9F7 !important;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23111111' fill-opacity='0.04' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E") !important;
      }
      body * { border-radius: 0 !important; }
      ::selection { background: #111111; color: #F9F9F7; }
    `}</style>
  );
}

/* ---------- 공통 UI 조각 ---------- */

const STAR_PATH =
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

// fill: 0(빈 별) / 0.5(반 별) / 1(꽉 찬 별)
function Star({ fill, size = 20 }: { fill: number; size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="absolute inset-0 text-[#E5E5E0]"
        fill="currentColor"
      >
        <path d={STAR_PATH} />
      </svg>
      <span
        className="absolute left-0 top-0 h-full overflow-hidden text-[#111111]"
        style={{ width: `${fill * 100}%` }}
      >
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
          <path d={STAR_PATH} />
        </svg>
      </span>
    </span>
  );
}

function RatingDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={Math.min(1, Math.max(0, value - i))} size={size} />
      ))}
    </span>
  );
}

// 별의 왼쪽 절반을 누르면 0.5점, 오른쪽 절반을 누르면 1점 단위. 같은 값을 다시 누르면 0점으로 초기화
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
    <div className="flex items-center gap-3">
      <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star fill={Math.min(1, Math.max(0, shown - i))} size={size} />
            <button
              type="button"
              aria-label={`${i + 0.5}점`}
              className="absolute left-0 top-0 h-full w-1/2 focus:outline-none"
              onMouseEnter={() => setHover(i + 0.5)}
              onClick={() => onChange(value === i + 0.5 ? 0 : i + 0.5)}
            />
            <button
              type="button"
              aria-label={`${i + 1}점`}
              className="absolute right-0 top-0 h-full w-1/2 focus:outline-none"
              onMouseEnter={() => setHover(i + 1)}
              onClick={() => onChange(value === i + 1 ? 0 : i + 1)}
            />
          </span>
        ))}
      </div>
      <span className="text-sm font-semibold">{value}점</span>
    </div>
  );
}

// 켜짐/꺼짐을 버튼으로 표현 (켜지면 검정으로 채워짐)
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
      className={pressed ? BTN : BTN_OUTLINE}
    >
      {children}
    </button>
  );
}

// 읽는 중 배지 (속보 배지처럼 빨간색)
function ReadingBadge() {
  return (
    <span className="inline-block bg-[#CC0000] px-2 py-0.5 text-[11px] font-semibold tracking-widest text-white">
      읽는 중
    </span>
  );
}

// 댓글(답글) 표시용 화살표 아이콘
function ReplyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      className="mt-1 shrink-0 text-[#A3A3A3]"
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

/* ---------- 디스코드 스타일 마크다운 ---------- */

// 스포일러: 클릭하면 보임
function Spoiler({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setShown(true);
      }}
      className={`px-0.5 ${shown ? 'bg-[#E5E5E0]' : 'bg-[#111111] cursor-pointer select-none'}`}
    >
      <span className={shown ? '' : 'invisible'}>{children}</span>
    </span>
  );
}

type InlinePattern = {
  re: RegExp;
  render: (m: RegExpExecArray, key: string) => React.ReactNode;
  valid?: (m: RegExpExecArray, src: string, offset: number) => boolean;
};

const isWordChar = (c?: string) => !!c && /[0-9A-Za-z가-힣]/.test(c);

// 위에 있을수록 같은 위치에서 우선 적용
const INLINE: InlinePattern[] = [
  // 역슬래시 이스케이프: \* \_ 등
  { re: /\\([\\*_~`|>#\[\]()\-])/, render: (m) => m[1] },
  // `코드`
  {
    re: /(`{1,3})([\s\S]+?)\1/,
    render: (m, key) => (
      <code
        key={key}
        className="px-1 py-0.5 bg-[#E5E5E0] text-[0.85em] font-normal not-italic text-[#111111]"
      >
        {m[2]}
      </code>
    ),
  },
  // ||스포일러||
  {
    re: /\|\|([\s\S]+?)\|\|/,
    render: (m, key) => <Spoiler key={key}>{parseInline(m[1], key)}</Spoiler>,
  },
  // ***굵은 기울임***
  {
    re: /\*\*\*([\s\S]+?)\*\*\*/,
    render: (m, key) => (
      <strong key={key}>
        <em>{parseInline(m[1], key)}</em>
      </strong>
    ),
  },
  // **굵게**
  {
    re: /\*\*([\s\S]+?)\*\*/,
    render: (m, key) => <strong key={key}>{parseInline(m[1], key)}</strong>,
  },
  // __밑줄__
  {
    re: /__([\s\S]+?)__/,
    render: (m, key) => <u key={key}>{parseInline(m[1], key)}</u>,
  },
  // ~~취소선~~
  {
    re: /~~([\s\S]+?)~~/,
    render: (m, key) => <s key={key}>{parseInline(m[1], key)}</s>,
  },
  // *기울임*
  {
    re: /\*([^\s*](?:[\s\S]*?[^\s*])?)\*/,
    render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em>,
  },
  // _기울임_ (단어 중간의 _ 는 무시)
  {
    re: /_([^\s_](?:[\s\S]*?[^\s_])?)_/,
    valid: (m, src, offset) =>
      !isWordChar(src[offset + m.index - 1]) && !isWordChar(src[offset + m.index + m[0].length]),
    render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em>,
  },
  // [글자](https://주소)
  {
    re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
    render: (m, key) => (
      <a
        key={key}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={(e) => e.stopPropagation()}
        className="underline decoration-2 decoration-[#CC0000] underline-offset-4"
      >
        {m[1]}
      </a>
    ),
  },
  // 그냥 주소
  {
    re: /https?:\/\/[^\s<>)\]]*[^\s<>)\].,!?;:'"]/,
    render: (m, key) => (
      <a
        key={key}
        href={m[0]}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={(e) => e.stopPropagation()}
        className="underline decoration-2 decoration-[#CC0000] underline-offset-4 break-all"
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

// 줄 단위 블록: 코드블록, > 인용, >>> 인용, # 제목, -# 작은 글씨, 목록
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

    // ``` 코드 블록 ```
    if (trimmed.startsWith('```') && (trimmed.match(/```/g) || []).length === 1) {
      const body: string[] = [];
      const first = trimmed.slice(3);
      if (first && !/^[\w+#.-]+$/.test(first)) body.push(first); // 언어 이름이면 버림
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
            className="my-1 p-3 border border-[#111111] bg-[#E5E5E0] text-xs font-normal not-italic text-[#111111] whitespace-pre overflow-x-auto"
          >
            <code>{body.join('\n')}</code>
          </pre>
        );
        i = j + 1;
        continue;
      }
    }

    // >>> 이후 전부 인용
    if (/^>>>(\s|$)/.test(trimmed)) {
      flush();
      const restText = [trimmed.replace(/^>>>\s?/, ''), ...lines.slice(i + 1)].join('\n');
      out.push(
        <blockquote key={key()} className="my-1 border-l-4 border-[#111111] pl-3 text-[#525252]">
          {renderBlocks(restText, key())}
        </blockquote>
      );
      i = lines.length;
      break;
    }

    // > 인용
    if (/^\s*>\s?/.test(line)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote key={key()} className="my-1 border-l-4 border-[#111111] pl-3 text-[#525252]">
          {renderBlocks(q.join('\n'), key())}
        </blockquote>
      );
      continue;
    }

    // # 제목
    const h = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flush();
      const size =
        h[1].length === 1 ? 'text-[1.5em]' : h[1].length === 2 ? 'text-[1.25em]' : 'text-[1.1em]';
      const kk = key();
      out.push(
        <p key={kk} className={`${size} font-black tracking-tight leading-snug mt-1`}>
          {parseInline(h[2], kk)}
        </p>
      );
      i++;
      continue;
    }

    // -# 작은 글씨
    const sub = trimmed.match(/^-#\s+(.+)$/);
    if (sub) {
      flush();
      const kk = key();
      out.push(
        <p key={kk} className="text-xs text-[#737373]">
          {parseInline(sub[1], kk)}
        </p>
      );
      i++;
      continue;
    }

    // - 목록
    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      const kk = key();
      out.push(
        <ul key={kk} className="list-disc pl-5 my-1">
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it, `${kk}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 1. 번호 목록
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      const kk = key();
      out.push(
        <ol key={kk} className="list-decimal pl-5 my-1">
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

// 줄 맨 앞에 블록 문법(#, >, -, 1., ```)이 있는지
const BLOCK_SYNTAX = /^\s*(#{1,3}\s|-#\s|>|[-*]\s|\d+[.)]\s)|```/m;

// wrapQuotes: 인용문 앞뒤에 따옴표를 붙임 (블록 문법이 들어간 글은 붙이지 않음)
function DiscordText({
  text,
  className = '',
  wrapQuotes = false,
}: {
  text: string;
  className?: string;
  wrapQuotes?: boolean;
}) {
  const src = wrapQuotes && !BLOCK_SYNTAX.test(text) ? `"${text}"` : text;
  return <div className={`whitespace-pre-line break-words ${className}`}>{renderBlocks(src)}</div>;
}

// 인용문(굵게 + 기울임) + 아래에 댓글처럼 달리는 여러 개의 코멘트
// 작성자 본인은 인용문을 탭하면 코멘트 입력창이 열리고, 코멘트만 따로 삭제할 수 있음
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
    <div className="divide-y divide-[#E5E5E0]">
      {quotes.map((q) => (
        <div key={q.id} className="py-4 first:pt-0">
          <div className="flex justify-between items-start gap-3">
            <div
              onClick={isOwner ? () => toggle(q.id) : undefined}
              className={`min-w-0 text-base font-bold italic leading-relaxed ${
                isOwner ? 'cursor-pointer hover:text-[#CC0000] transition-colors duration-200' : ''
              }`}
            >
              <DiscordText text={q.content} wrapQuotes />
            </div>
            {onDeleteQuote && (
              <button onClick={() => onDeleteQuote(q.id)} className={`${DANGER_BTN} shrink-0`}>
                인용문 삭제
              </button>
            )}
          </div>

          {q.quote_comments.length > 0 && (
            <div className="mt-2 ml-2 space-y-1.5">
              {q.quote_comments.map((c) => (
                <div key={c.id} className="flex items-start gap-1.5 text-sm text-[#525252]">
                  <ReplyIcon />
                  <DiscordText text={c.content} className="flex-1 min-w-0 leading-relaxed" />
                  {isOwner && onDeleteComment && (
                    <button onClick={() => onDeleteComment(c.id)} className={`${DANGER_BTN} shrink-0`}>
                      삭제
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwner && openId === q.id && (
            <form onSubmit={(e) => submit(e, q.id)} className="mt-3 ml-2 flex gap-2 items-end">
              <input
                type="text"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="코멘트를 입력하세요"
                className={`${INPUT} flex-1`}
              />
              <button type="submit" className={BTN_SM}>
                등록
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t-4 border-[#111111]">
      <div className="max-w-screen-xl mx-auto px-4 py-4 flex flex-wrap justify-between gap-2 text-[11px] uppercase tracking-widest text-[#737373]">
        <span>ReadPot</span>
        <span>Edition: Vol 1.0</span>
      </div>
    </footer>
  );
}

/* ---------- 메인 ---------- */

export default function Home() {
  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // 책 검색 / 신규 등록
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [initialQuote, setInitialQuote] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // 데이터 (모든 유저의 글 + 닉네임)
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  // 화면 상태
  const [tab, setTab] = useState<Tab>('mine');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [boardFilter, setBoardFilter] = useState('');
  const [showOthers, setShowOthers] = useState(true); // 같은 책 다른 사람 기록 함께 보기
  const [newQuoteInput, setNewQuoteInput] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContentText, setEditContentText] = useState('');
  const [today, setToday] = useState('');

  // 날짜는 브라우저에서만 계산 (서버/브라우저 시간 차이로 인한 오류 방지)
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

  const nameOf = (userId: string) => {
    if (profiles[userId]) return profiles[userId];
    if (user && userId === user.id) return (user.email || '나').split('@')[0];
    return '알 수 없음';
  };

  const myReviews = allReviews.filter((r) => r.user_id === user?.id);
  const activeReview = allReviews.find((r) => r.id === activeId) ?? null;
  const isOwner = !!activeReview && activeReview.user_id === user?.id;
  const otherReviews = activeReview
    ? allReviews.filter((r) => r.book_isbn === activeReview.book_isbn && r.id !== activeReview.id)
    : [];

  const loadData = useCallback(async (u: User) => {
    const [reviewsRes, profilesRes] = await Promise.all([
      supabase
        .from('reviews')
        .select(
          'id, user_id, book_isbn, rating, status, content, created_at, books(title, author, cover_url), quotes(id, content, created_at, quote_comments(id, content, created_at))'
        )
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nickname'),
    ]);

    if (reviewsRes.error) console.error('reviews 에러:', reviewsRes.error.message);
    if (profilesRes.error) console.error('profiles 에러:', profilesRes.error.message);

    const map: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => {
      map[p.id] = p.nickname;
    });

    // 내 프로필이 없으면 이메일 앞부분으로 자동 생성
    if (!profilesRes.error && !map[u.id]) {
      const nick = (u.email || '사용자').split('@')[0];
      await supabase
        .from('profiles')
        .upsert({ id: u.id, nickname: nick }, { onConflict: 'id', ignoreDuplicates: true });
      map[u.id] = nick;
    }
    setProfiles(map);

    if (!reviewsRes.error && reviewsRes.data) {
      const normalized = (reviewsRes.data as any[])
        .filter((r) => r.books)
        .map((r) => ({
          ...r,
          rating: Number(r.rating) || 0,
          quotes: (r.quotes || [])
            .map((q: any) => ({
              ...q,
              quote_comments: (q.quote_comments || []).sort(byCreated),
            }))
            .sort(byCreated),
        }));
      setAllReviews(normalized as Review[]);
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

  // ---------- 인증 ----------
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
    } catch (err: any) {
      alert(`인증 에러: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAllReviews([]);
    setActiveId(null);
  };

  const handleChangeNickname = async () => {
    if (!user) return;
    const next = window.prompt('새 닉네임을 입력해 주세요 (20자 이내)', nameOf(user.id));
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return alert('닉네임을 입력해 주세요.');
    if (trimmed.length > 20) return alert('닉네임은 20자 이내로 입력해 주세요.');

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, nickname: trimmed }, { onConflict: 'id' });
    if (error) return alert(`닉네임 변경 실패: ${error.message}`);
    refresh();
  };

  // ---------- 책 검색 / 등록 ----------
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/books/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.documents || []);
    } catch (err) {
      alert('책 검색 실패');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !user) return;

    const isbnList = selectedBook.isbn.trim().split(' ');
    const primaryIsbn = isbnList[isbnList.length - 1] || selectedBook.isbn;

    try {
      // 이미 내 서재에 있는 책이면 그 글로 이동
      const { data: dup } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', user.id)
        .eq('book_isbn', primaryIsbn)
        .maybeSingle();

      if (dup) {
        alert('이미 서재에 있는 책이에요. 해당 글로 이동할게요.');
        setSelectedBook(null);
        setActiveId(dup.id);
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
          rating: isReading ? 0 : rating,
          status: isReading ? 'reading' : 'completed',
          content: '',
        })
        .select()
        .single();
      if (reviewError) throw reviewError;

      if (initialQuote.trim() && reviewData) {
        const { error: quoteError } = await supabase.from('quotes').insert({
          review_id: reviewData.id,
          user_id: user.id,
          content: initialQuote.trim(),
        });
        if (quoteError) throw quoteError;
      }

      setSelectedBook(null);
      setInitialQuote('');
      setRating(0);
      setIsReading(false);
      setSearchResults([]);
      setQuery('');
      await loadData(user);

      // 등록하자마자 해당 글 상세 화면으로 이동
      setTab('mine');
      setActiveId(reviewData.id);
      setIsEditingContent(false);
      setEditContentText('');
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    }
  };

  // ---------- 상태 / 별점 수정 ----------
  const handleUpdateStatus = async (nextReading: boolean, nextRating: number) => {
    if (!activeReview || !isOwner) return;
    const nextStatus = nextReading ? 'reading' : 'completed';
    const savedRating = nextReading ? 0 : nextRating;

    // 화면 먼저 반영
    setAllReviews((prev) =>
      prev.map((r) =>
        r.id === activeReview.id ? { ...r, status: nextStatus, rating: savedRating } : r
      )
    );

    const { error } = await supabase
      .from('reviews')
      .update({ status: nextStatus, rating: savedRating })
      .eq('id', activeReview.id);

    if (error) {
      alert(`저장 실패: ${error.message}`);
      refresh();
    }
  };

  // ---------- 인용문 ----------
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
    } catch (err: any) {
      alert(`인용문 추가 실패: ${err.message}`);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('이 인용문을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
      if (error) throw error;
      refresh();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // ---------- 코멘트 (인용문 하나에 여러 개 가능) ----------
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

  // ---------- 독후감 ----------
  const startWritingReview = () => {
    setEditContentText('');
    setIsEditingContent(true);
    setTimeout(() => {
      document.getElementById('review-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleSaveContentEdit = async () => {
    if (!activeReview || !isOwner) return;
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ content: editContentText.trim() })
        .eq('id', activeReview.id);
      if (error) throw error;
      setIsEditingContent(false);
      refresh();
    } catch (err: any) {
      alert(`독후감 저장 실패: ${err.message}`);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('이 책과 관련된 모든 기록(인용문 포함)을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) throw error;
      setActiveId(null);
      refresh();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // ---------- 화면 이동 ----------
  const openReview = (rev: Review) => {
    setActiveId(rev.id);
    setIsEditingContent(false);
    setEditContentText(rev.content || '');
    setNewQuoteInput('');
    window.scrollTo({ top: 0 });
  };

  const goTab = (t: Tab) => {
    setTab(t);
    setActiveId(null);
    setBoardFilter('');
  };

  const matchesFilter = (r: Review) => {
    const q = boardFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      r.books.title.toLowerCase().includes(q) ||
      r.books.author.toLowerCase().includes(q) ||
      nameOf(r.user_id).toLowerCase().includes(q)
    );
  };

  // ---------- 로그인 화면 ----------
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 text-[#111111]">
        <GlobalStyle />
        <div className="w-full max-w-md border-4 border-[#111111] bg-[#F9F9F7] p-8">
          <p className="text-center text-[11px] uppercase tracking-widest text-[#737373] mb-3">
            Vol. 1 &middot; The Reading Edition
          </p>
          <h1 className="text-center text-5xl font-black tracking-tighter leading-none border-b-4 border-[#111111] pb-4">
            ReadPot
          </h1>
          <p className="text-center text-sm text-[#525252] mt-4 mb-8">
            {isSignUp ? '새로운 계정 생성하기' : '함께 읽고, 인용하고, 기록하세요'}
          </p>

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className={LABEL}>이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className={INPUT}
                required
              />
            </div>

            <div>
              <label className={LABEL}>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자리 이상 비밀번호"
                className={INPUT}
                required
              />
            </div>

            <button type="submit" disabled={authLoading} className={`${BTN} w-full`}>
              {authLoading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setIsSignUp(!isSignUp)} className={LINK_BTN}>
              {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- 공통 헤더 (신문 제호) ----------
  const header = (
    <header className="sticky top-0 z-40 bg-[#F9F9F7] border-b-4 border-[#111111]">
      <div className="bg-[#111111] text-[#F9F9F7]">
        <div className="max-w-screen-xl mx-auto px-4 py-1 flex justify-between gap-3 text-[11px] uppercase tracking-widest">
          <span>Vol. 1 &middot; {today}</span>
          <span className="hidden sm:inline">The Reading Edition</span>
        </div>
      </div>
      <div className="max-w-screen-xl mx-auto px-4 flex flex-wrap items-center justify-between gap-x-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <button onClick={() => goTab('mine')} className={FOCUS}>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter leading-none py-2">ReadPot</h1>
          </button>
          <nav className="flex">
            {(
              [
                ['mine', '내 서재'],
                ['community', '전체 서재'],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => goTab(t)}
                className={`min-h-[44px] px-3 text-xs font-semibold tracking-widest transition-colors duration-200 ${FOCUS} ${
                  tab === t ? 'bg-[#111111] text-[#F9F9F7]' : 'hover:text-[#CC0000]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleChangeNickname}
            title="닉네임 변경"
            className={`hidden sm:inline-flex items-center min-h-[44px] text-xs font-semibold tracking-widest hover:text-[#CC0000] transition-colors duration-200 ${FOCUS}`}
          >
            {nameOf(user.id)}
          </button>
          <button onClick={handleLogout} className={BTN_OUTLINE}>
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );

  // ---------- 게시판 표 ----------
  const renderBoard = (list: Review[], showAuthor: boolean) => {
    const col = showAuthor
      ? { title: 'sm:col-span-4', author: 'sm:col-span-2', nick: 'sm:col-span-2', status: 'sm:col-span-2', quotes: 'sm:col-span-1', date: 'sm:col-span-1' }
      : { title: 'sm:col-span-5', author: 'sm:col-span-2', nick: '', status: 'sm:col-span-2', quotes: 'sm:col-span-2', date: 'sm:col-span-1' };

    return (
      <>
        {/* 검정으로 반전된 표 머리글 */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2 bg-[#111111] text-[#F9F9F7] text-[11px] font-semibold uppercase tracking-widest">
          <span className={col.title}>책 제목</span>
          <span className={col.author}>저자</span>
          {showAuthor && <span className={col.nick}>작성자</span>}
          <span className={`${col.status} text-center`}>상태 / 별점</span>
          <span className={`${col.quotes} text-center`}>인용문</span>
          <span className={`${col.date} text-right`}>날짜</span>
        </div>

        <ul>
          {list.map((rev) => (
            <li
              key={rev.id}
              onClick={() => openReview(rev)}
              className="grid grid-cols-12 gap-3 items-center px-5 py-3 border-b border-[#111111] last:border-b-0 hover:bg-[#F5F5F5] cursor-pointer transition-colors duration-200 group"
            >
              <div className={`col-span-12 ${col.title} flex items-center gap-3 min-w-0`}>
                <img
                  src={rev.books.cover_url || undefined}
                  alt={rev.books.title}
                  className="w-9 h-12 object-cover border border-[#111111] bg-[#E5E5E5] grayscale transition duration-200 group-hover:sepia-[50%] shrink-0"
                />
                <span className="font-bold text-sm truncate underline-offset-4 decoration-2 decoration-[#CC0000] group-hover:underline">
                  {rev.books.title}
                </span>
              </div>
              <span className={`col-span-6 ${col.author} text-xs text-[#525252] truncate`}>
                {rev.books.author}
              </span>
              {showAuthor && (
                <span className={`col-span-6 ${col.nick} text-xs font-semibold truncate`}>
                  {nameOf(rev.user_id)}
                </span>
              )}
              <div className={`col-span-6 ${col.status} flex sm:justify-center`}>
                {rev.status === 'reading' ? (
                  <ReadingBadge />
                ) : (
                  <RatingDisplay value={rev.rating} size={13} />
                )}
              </div>
              <span className={`col-span-6 ${col.quotes} sm:text-center text-xs text-[#525252]`}>
                인용문 {rev.quotes?.length || 0}
              </span>
              <span className={`hidden sm:block ${col.date} text-right text-[11px] text-[#737373]`}>
                {new Date(rev.created_at).toLocaleDateString('ko-KR', {
                  month: 'numeric',
                  day: 'numeric',
                })}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  };

  // ---------- 상세 화면 ----------
  if (activeReview) {
    const hasQuotes = (activeReview.quotes?.length || 0) > 0;
    const showReview = (isEditingContent && isOwner) || !!activeReview.content;
    const showQuotes = isOwner || hasQuotes;
    const hasSidebar = otherReviews.length > 0;

    return (
      <div className="min-h-screen text-[#111111]">
        <GlobalStyle />
        {header}
        <main className="max-w-screen-xl mx-auto px-4 py-8 space-y-4">
          <button onClick={() => setActiveId(null)} className={`${LINK_BTN} min-h-[44px]`}>
            &larr; 목록으로 돌아가기
          </button>

          <article className="border border-[#111111] bg-[#F9F9F7]">
            {/* 책 정보 블록: 우측 상단에 읽는 중 / 독후감 추가 버튼 */}
            <section className="p-5 md:p-6 border-b-4 border-[#111111]">
              <div className="flex gap-5">
                <img
                  src={activeReview.books.cover_url || undefined}
                  alt={activeReview.books.title}
                  className="w-24 h-36 object-cover border border-[#111111] bg-[#E5E5E5] grayscale transition duration-200 hover:sepia-[50%] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-widest text-[#737373]">
                        {nameOf(activeReview.user_id)} &middot;{' '}
                        {new Date(activeReview.created_at).toLocaleDateString('ko-KR')}
                      </p>
                      <h2 className="mt-1 text-3xl md:text-4xl font-black tracking-tight leading-tight">
                        {activeReview.books.title}
                      </h2>
                      <p className="mt-1 text-sm text-[#525252]">{activeReview.books.author}</p>
                    </div>

                    {isOwner && (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <ToggleButton
                          pressed={activeReview.status === 'reading'}
                          onClick={() =>
                            handleUpdateStatus(activeReview.status !== 'reading', activeReview.rating)
                          }
                        >
                          읽는 중
                        </ToggleButton>
                        {!activeReview.content && !isEditingContent && (
                          <button onClick={startWritingReview} className={BTN_OUTLINE}>
                            독후감 추가
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    {isOwner ? (
                      activeReview.status !== 'reading' && (
                        <RatingInput
                          value={activeReview.rating}
                          onChange={(v) => handleUpdateStatus(false, v)}
                          size={26}
                        />
                      )
                    ) : activeReview.status === 'reading' ? (
                      <ReadingBadge />
                    ) : (
                      <div className="flex items-center gap-2">
                        <RatingDisplay value={activeReview.rating} size={22} />
                        <span className="text-sm font-semibold">{activeReview.rating}점</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* 왼쪽 8칸: 인용문 + 독후감 */}
              <div className={hasSidebar ? 'lg:col-span-8 lg:border-r border-[#111111]' : 'lg:col-span-12'}>
                {showQuotes && (
                  <section className={`p-5 md:p-6 ${showReview ? 'border-b border-[#111111]' : ''}`}>
                    <h3 className="text-xl font-black tracking-tight">
                      인용문{' '}
                      <span className="text-sm font-semibold text-[#737373]">
                        ({activeReview.quotes?.length || 0})
                      </span>
                    </h3>
                    {isOwner && hasQuotes && (
                      <p className="mt-1 text-xs text-[#737373]">인용문을 누르면 코멘트를 달 수 있어요.</p>
                    )}

                    <div className="mt-4">
                      {hasQuotes ? (
                        <QuoteList
                          quotes={activeReview.quotes!}
                          isOwner={isOwner}
                          onDeleteQuote={isOwner ? handleDeleteQuote : undefined}
                          onAddComment={isOwner ? handleAddComment : undefined}
                          onDeleteComment={isOwner ? handleDeleteComment : undefined}
                        />
                      ) : (
                        <p className="text-sm text-[#737373]">아직 추가된 인용문이 없습니다.</p>
                      )}
                    </div>

                    {/* 인용문 쓰는 칸은 목록 아래 */}
                    {isOwner && (
                      <form
                        onSubmit={handleAddQuote}
                        className="mt-5 pt-5 border-t border-[#111111] flex gap-3 items-end"
                      >
                        <div className="flex-1">
                          <label className={LABEL}>새 인용문</label>
                          <textarea
                            rows={2}
                            value={newQuoteInput}
                            onChange={(e) => setNewQuoteInput(e.target.value)}
                            placeholder="마음에 남은 문장을 적어 보세요"
                            className={`${INPUT} leading-relaxed`}
                          />
                        </div>
                        <button type="submit" className={BTN}>
                          추가
                        </button>
                      </form>
                    )}
                  </section>
                )}

                {/* 독후감: 내용이 있거나 작성 중일 때만 항목이 보임 */}
                {isEditingContent && isOwner ? (
                  <section id="review-editor" className="p-5 md:p-6 space-y-3">
                    <h3 className="text-xl font-black tracking-tight">독후감</h3>
                    <textarea
                      rows={10}
                      autoFocus
                      value={editContentText}
                      onChange={(e) => setEditContentText(e.target.value)}
                      placeholder="이 책을 읽고 느낀 점을 자유롭게 적어 보세요."
                      className={TEXTAREA_BOX}
                    />
                    <p className="text-xs text-[#737373]">
                      {'디스코드 마크다운 사용 가능: **굵게** *기울임* __밑줄__ ~~취소선~~ ||스포일러|| `코드` > 인용 # 제목 - 목록'}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setIsEditingContent(false)} className={BTN_OUTLINE}>
                        취소
                      </button>
                      <button onClick={handleSaveContentEdit} className={BTN}>
                        저장
                      </button>
                    </div>
                  </section>
                ) : activeReview.content ? (
                  <section className="p-5 md:p-6 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black tracking-tight">독후감</h3>
                      {isOwner && (
                        <button
                          onClick={() => {
                            setEditContentText(activeReview.content || '');
                            setIsEditingContent(true);
                          }}
                          className={LINK_BTN}
                        >
                          수정하기
                        </button>
                      )}
                    </div>
                    <DiscordText
                      text={activeReview.content}
                      className="text-sm leading-relaxed text-[#262626]"
                    />
                  </section>
                ) : null}
              </div>

              {/* 오른쪽 4칸: 같은 책을 읽은 사람 (켜고 끌 수 있음) */}
              {hasSidebar && (
                <aside className="lg:col-span-4 border-t lg:border-t-0 border-[#111111] p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-black tracking-tight">
                      같은 책을 읽은 사람{' '}
                      <span className="text-sm font-semibold text-[#737373]">({otherReviews.length})</span>
                    </h3>
                    <ToggleButton pressed={showOthers} onClick={() => setShowOthers(!showOthers)}>
                      함께 보기
                    </ToggleButton>
                  </div>

                  {showOthers &&
                    otherReviews.map((o) => (
                      <div key={o.id} className="border-t border-[#111111] pt-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm">{nameOf(o.user_id)}</span>
                          {o.status === 'reading' ? (
                            <ReadingBadge />
                          ) : (
                            <RatingDisplay value={o.rating} size={14} />
                          )}
                        </div>

                        {o.quotes && o.quotes.length > 0 && <QuoteList quotes={o.quotes} />}

                        {o.content && (
                          <div className="space-y-1">
                            <p className={LABEL}>독후감</p>
                            <DiscordText
                              text={o.content}
                              className="text-sm leading-relaxed text-[#262626]"
                            />
                          </div>
                        )}

                        {(!o.quotes || o.quotes.length === 0) && !o.content && (
                          <p className="text-xs text-[#737373]">아직 남긴 기록이 없어요.</p>
                        )}
                      </div>
                    ))}
                </aside>
              )}
            </div>

            <div className="flex justify-between items-center gap-3 p-4 border-t border-[#111111]">
              {isOwner ? (
                <button onClick={() => handleDeleteReview(activeReview.id)} className={DANGER_BTN}>
                  이 책 서재에서 삭제
                </button>
              ) : (
                <span />
              )}
              <button onClick={() => setActiveId(null)} className={BTN_OUTLINE}>
                목록으로
              </button>
            </div>
          </article>
        </main>
        <Footer />
      </div>
    );
  }

  // ---------- 전체 서재 (모든 유저의 글) ----------
  if (tab === 'community') {
    const list = allReviews.filter(matchesFilter);

    return (
      <div className="min-h-screen text-[#111111]">
        <GlobalStyle />
        {header}
        <main className="max-w-screen-xl mx-auto px-4 py-8">
          <section className="border border-[#111111] bg-[#F9F9F7]">
            <div className="flex flex-wrap justify-between items-end gap-3 px-5 py-4 border-b-4 border-[#111111]">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#737373]">Everyone&apos;s Shelf</p>
                <h2 className="text-3xl font-black tracking-tight">
                  전체 서재{' '}
                  <span className="text-sm font-semibold text-[#737373]">총 {allReviews.length}개의 기록</span>
                </h2>
              </div>
              <input
                type="text"
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
                placeholder="책, 저자, 작성자 찾기..."
                className={`${INPUT} sm:w-64`}
              />
            </div>

            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#737373]">
                <p className="text-sm">
                  {allReviews.length === 0 ? '아직 올라온 글이 없습니다.' : '검색 결과가 없습니다.'}
                </p>
              </div>
            ) : (
              renderBoard(list, true)
            )}
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // ---------- 내 서재 ----------
  const myList = myReviews.filter(matchesFilter);

  return (
    <div className="min-h-screen text-[#111111]">
      <GlobalStyle />
      {header}
      <main className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="border border-[#111111] bg-[#F9F9F7] grid grid-cols-1 lg:grid-cols-12">
          {/* 왼쪽 4칸: 책 검색해서 새 글 만들기 */}
          <section className="lg:col-span-4 p-5 border-b lg:border-b-0 lg:border-r border-[#111111] space-y-5">
            <div className="border-b-2 border-[#111111] pb-2">
              <p className="text-[11px] uppercase tracking-widest text-[#737373]">New Entry</p>
              <h2 className="text-xl font-black tracking-tight">책 검색해서 새 글 만들기</h2>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 items-end">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="책 제목 또는 저자 검색..."
                className={`${INPUT} flex-1`}
              />
              <button type="submit" disabled={searchLoading} className={BTN}>
                {searchLoading ? '검색 중...' : '검색'}
              </button>
            </form>

            {searchResults.length > 0 && !selectedBook && (
              <div className="divide-y divide-[#E5E5E0] border-y border-[#111111] max-h-96 overflow-y-auto">
                {searchResults.map((book, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={book.thumbnail || undefined}
                        alt={book.title}
                        className="w-11 h-16 object-cover border border-[#111111] bg-[#E5E5E5] grayscale shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{book.title}</p>
                        <p className="text-xs text-[#525252] truncate">{book.authors.join(', ')}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedBook(book)} className={`${BTN_OUTLINE} !min-h-[36px] !px-3 shrink-0`}>
                      선택
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedBook && (
              <div className="border-2 border-[#111111] p-4 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black tracking-tight">새 책 서재에 추가</h3>
                  <button onClick={() => setSelectedBook(null)} className={DANGER_BTN}>
                    다시 선택
                  </button>
                </div>

                <div className="flex items-center gap-3 border-y border-[#111111] py-3">
                  <img
                    src={selectedBook.thumbnail || undefined}
                    alt={selectedBook.title}
                    className="w-12 h-16 object-cover border border-[#111111] bg-[#E5E5E5] grayscale"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{selectedBook.title}</p>
                    <p className="text-xs text-[#525252] truncate">{selectedBook.authors.join(', ')}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitReview} className="space-y-5">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <ToggleButton pressed={isReading} onClick={() => setIsReading(!isReading)}>
                      읽는 중
                    </ToggleButton>
                    {!isReading && <RatingInput value={rating} onChange={setRating} size={26} />}
                  </div>

                  <div>
                    <label className={LABEL}>첫 번째 인용문 (선택)</label>
                    <input
                      type="text"
                      value={initialQuote}
                      onChange={(e) => setInitialQuote(e.target.value)}
                      placeholder="인상 깊었던 문장을 입력해 보세요"
                      className={INPUT}
                    />
                  </div>

                  <button type="submit" className={`${BTN} w-full`}>
                    내 서재에 등록하기
                  </button>
                </form>
              </div>
            )}
          </section>

          {/* 오른쪽 8칸: 내 서재 게시판 */}
          <section className="lg:col-span-8">
            <div className="flex flex-wrap justify-between items-end gap-3 px-5 py-4 border-b-4 border-[#111111]">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#737373]">My Shelf</p>
                <h2 className="text-3xl font-black tracking-tight">
                  내 서재{' '}
                  <span className="text-sm font-semibold text-[#737373]">총 {myReviews.length}권</span>
                </h2>
              </div>
              <input
                type="text"
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
                placeholder="내 서재에서 찾기..."
                className={`${INPUT} sm:w-56`}
              />
            </div>

            {myList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#737373]">
                <p className="text-sm">
                  {myReviews.length === 0
                    ? '등록된 책이 없습니다. 왼쪽에서 책을 검색해 첫 글을 만들어 보세요.'
                    : '검색 결과가 없습니다.'}
                </p>
              </div>
            ) : (
              renderBoard(myList, false)
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
