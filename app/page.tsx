'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
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
  status: Status;
  created_at: string;
  books: {
    title: string;
    author: string;
    cover_url: string;
  };
  quotes?: QuoteItem[];
}

type Tab = 'mine' | 'community' | 'profile';
type Status = 'wishlist' | 'reading' | 'completed';

interface Profile {
  nickname: string;
  seal_text: string | null;
  seal_color: string | null;
  seal_style: string | null;
}

const byCreated = (a: { created_at: string }, b: { created_at: string }) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

/* ---------- Newsprint 디자인 토큰 ----------
   paper #F9F9F7 / ink #111111 / divider #E5E5E0 / accent #CC0000
   둥근 모서리 없음, 검은 1px 테두리, 입력칸은 아래 선만 */

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2';

// 기본 버튼: 검정 바탕, hover 시 흰 바탕으로 반전
const BTN = `inline-flex items-center justify-center min-h-[44px] px-3 sm:px-5 border border-[#111111] bg-[#111111] text-[#F9F9F7] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-white hover:text-[#111111] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
// 보조 버튼: 테두리만, hover 시 검정으로 채워짐
const BTN_OUTLINE = `inline-flex items-center justify-center min-h-[44px] px-3 sm:px-5 border border-[#111111] bg-transparent text-[#111111] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-[#111111] hover:text-[#F9F9F7] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
// 작은 버튼
const BTN_SM = `inline-flex items-center justify-center min-h-[36px] px-3 border border-[#111111] bg-[#111111] text-[#F9F9F7] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-white hover:text-[#111111] ${FOCUS}`;
// 텍스트 링크형 버튼: hover 시 빨간 밑줄
const LINK_BTN = `text-xs font-semibold tracking-widest text-[#111111] underline-offset-4 decoration-2 decoration-[#CC0000] hover:underline ${FOCUS}`;
// 지우기 같은 위험 동작
const DANGER_BTN = `text-xs text-[#737373] underline-offset-4 decoration-2 decoration-[#CC0000] hover:text-[#CC0000] hover:underline ${FOCUS}`;
// 입력칸: 아래 2px 선만
const INPUT = `w-full min-w-0 bg-transparent border-b-2 border-[#111111] px-1 py-2 text-sm placeholder:text-[#A3A3A3] focus:bg-[#F0F0F0] focus:outline-none`;
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
        overflow-x: clip;
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
  className = '',
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${pressed ? BTN : BTN_OUTLINE} ${className}`}
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

/* ---------- 인장(도장) ---------- */

const SEAL_COLORS: Record<string, { label: string; hex: string }> = {
  ink: { label: '먹색', hex: '#111111' },
  red: { label: '붉은색', hex: '#CC0000' },
  grey: { label: '회색', hex: '#525252' },
};

const SEAL_STYLES: [string, string][] = [
  ['solid', '채움'],
  ['outline', '테두리'],
  ['double', '겹테두리'],
];

// 닉네임 옆에 찍히는 네모난 도장. 1~2글자, 색 3종, 모양 3종
function Seal({
  text,
  color = 'ink',
  styleType = 'solid',
  size = 20,
}: {
  text: string;
  color?: string;
  styleType?: string;
  size?: number;
}) {
  const hex = (SEAL_COLORS[color] ?? SEAL_COLORS.ink).hex;
  const w = Math.max(1, Math.round(size / 14));
  const chars = Array.from(text || '').slice(0, 2).join('');
  const len = Array.from(chars).length;

  const common: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: len > 1 ? size * 0.42 : size * 0.6,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: len > 1 ? '-0.04em' : '0',
    transform: 'rotate(-4deg)',
  };

  let extra: React.CSSProperties;
  if (styleType === 'outline') {
    extra = { color: hex, border: `${w}px solid ${hex}`, background: 'transparent' };
  } else if (styleType === 'double') {
    extra = {
      color: hex,
      border: `${w}px solid ${hex}`,
      background: 'transparent',
      boxShadow: `inset 0 0 0 ${w}px #F9F9F7, inset 0 0 0 ${w * 2}px ${hex}`,
    };
  } else {
    extra = { color: '#F9F9F7', background: hex, border: `${w}px solid ${hex}` };
  }

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center select-none"
      style={{ ...common, ...extra }}
    >
      {chars}
    </span>
  );
}

// 읽고 싶은 책 배지
function WishBadge() {
  return (
    <span className="inline-block border border-[#111111] px-2 py-0.5 text-[11px] font-semibold tracking-widest">
      읽고 싶음
    </span>
  );
}

// 상태에 따라 배지 또는 별점을 보여줌
function StatusCell({ review, size = 13 }: { review: Review; size?: number }) {
  if (review.status === 'reading') return <ReadingBadge />;
  if (review.status === 'wishlist') return <WishBadge />;
  return <RatingDisplay value={review.rating} size={size} />;
}

/* ---------- 시리즈 묶기 (전체 서재) ---------- */

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

// 책 제목 끝의 권수 표시("1", "3권", "Vol.2", "(상)" 등)를 찾아 시리즈 이름과 권수로 나눔
function parseSeries(rawTitle: string): { base: string; volume: number; label: string } | null {
  const t = rawTitle.trim();
  // "(큰글자도서)" 같은 꼬리표를 떼고 한 번 더 시도
  const candidates = [t, t.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/, '').trim()];

  for (const s of candidates) {
    if (!s) continue;
    let m: RegExpMatchArray | null;

    // Vol. 3 / volume 3 / #3
    m = s.match(/^(.*\S)[\s,]*(?:vol\.?|volume|#)\s*(\d{1,3})$/i);
    if (m) return finish(m[1], Number(m[2]), `${Number(m[2])}권`);

    // 제목 (3) / 제목 [3]
    m = s.match(/^(.*\S)\s*[\(\[]\s*(\d{1,3})\s*[\)\]]$/);
    if (m) return finish(m[1], Number(m[2]), `${Number(m[2])}권`);

    // 제목 3권 / 제목 제3권 / 제목3권
    m = s.match(/^(.*?\S)\s*(?:제\s*)?(\d{1,3})\s*권$/);
    if (m) return finish(m[1], Number(m[2]), `${Number(m[2])}권`);

    // 제목 3  (숫자 앞에 공백이 있을 때만)
    m = s.match(/^(.*\S)\s+(\d{1,3})$/);
    if (m) return finish(m[1], Number(m[2]), `${Number(m[2])}권`);

    // 제목 (상) / 제목 상권
    m = s.match(/^(.*\S)[\s\(\[]+(상|중|하)\s*(?:권)?\s*[\)\]]?$/);
    if (m) {
      const order = { 상: 1, 중: 2, 하: 3 } as Record<string, number>;
      return finish(m[1], order[m[2]], `${m[2]}권`);
    }
  }
  return null;

  function finish(base: string, volume: number, label: string) {
    const b = cleanBase(base);
    // 너무 짧거나 숫자뿐인 제목, 200을 넘는 숫자(연도 등)는 시리즈로 보지 않음
    if (Array.from(b).length < 2 || /^\d+$/.test(b) || volume > 200) return null;
    return { base: b, volume, label };
  }
}

// 같은 시리즈(제목 앞부분 + 첫 저자)가 2권 이상 있으면 한 줄로 묶음
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

/* ---------- 스크랩 (뉴스/칼럼 읽기 + 형광펜 + 각주 코멘트) ---------- */

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

const HL_COLORS: Record<string, string> = {
  red: 'rgba(204, 0, 0, 0.28)',
  blue: 'rgba(0, 71, 204, 0.28)',
};

// 각주 번호는 문장 끝 위치 순서대로
const sortNotes = (notes: ClipNote[]) =>
  [...notes].sort((a, b) => a.end_offset - b.end_offset || byCreated(a, b));

// 선택 영역의 끝점이 본문 글자로 몇 번째인지 계산 (각주 번호 글자는 세지 않음)
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

// 본문 + 형광펜 + 각주 번호. 가장 늦게 칠한 획이 이기고, '지우개' 획은 색을 없앰
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

      out.push(
        <span
          key={`s${a}`}
          data-start={a}
          style={color ? { backgroundColor: HL_COLORS[color] } : undefined}
          className={noted ? 'underline decoration-[#111111] decoration-1 underline-offset-4' : undefined}
        >
          {content.slice(a, b)}
        </span>
      );

      sorted
        .filter((n) => clamp(n.end_offset) === b)
        .forEach((n) => {
          out.push(
            <sup
              key={`f${n.id}`}
              data-fn={numberOf.get(n.id)}
              onClick={() => scrollToNote(n.id)}
              style={{ userSelect: 'none' }}
              className="ml-0.5 cursor-pointer text-[11px] font-black hover:text-[#CC0000]"
            >
              {numberOf.get(n.id)})
            </sup>
          );
        });
    }
    return out;
  }, [content, highlights, notes]);

  return (
    <div ref={containerRef} className="whitespace-pre-wrap break-words text-base sm:text-[17px] leading-8">
      {nodes}
    </div>
  );
});

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
  const [regStatus, setRegStatus] = useState<Status>('completed');
  const [rating, setRating] = useState<number>(0);
  const [searchLoading, setSearchLoading] = useState(false);

  // 데이터 (모든 유저의 글 + 닉네임)
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  // 화면 상태
  const [tab, setTab] = useState<Tab>('mine');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [boardFilter, setBoardFilter] = useState('');
  const [showOthers, setShowOthers] = useState(true); // 같은 책 다른 사람 기록 함께 보기
  const [newQuoteInput, setNewQuoteInput] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContentText, setEditContentText] = useState('');
  const [today, setToday] = useState('');

  // 시리즈 보기 (전체 서재)
  const [activeSeries, setActiveSeries] = useState<string | null>(null);
  const [activeVolume, setActiveVolume] = useState<number | null>(null);

  // 스크랩 (뉴스/칼럼 읽기)
  const [clippings, setClippings] = useState<Clipping[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [clipTitle, setClipTitle] = useState('');
  const [clipSource, setClipSource] = useState('');
  const [clipContent, setClipContent] = useState('');
  const [clipSaving, setClipSaving] = useState(false);
  const [clipFetching, setClipFetching] = useState(false);
  const [clipFetchError, setClipFetchError] = useState('');
  const [newKind, setNewKind] = useState<'book' | 'clip'>('book'); // 새 글 만들기: 책 / 스크랩
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [noteDraftText, setNoteDraftText] = useState('');
  const articleRef = useRef<HTMLDivElement>(null);

  // 프로필 편집
  const [draft, setDraft] = useState({ nickname: '', sealText: '', sealColor: 'ink', sealStyle: 'solid' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

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

  // 닉네임/인장 정보 (없으면 기본값: 닉네임 첫 글자, 먹색, 채움)
  const profileOf = (userId: string) => {
    const p = profiles[userId];
    const nickname =
      p?.nickname || (user && userId === user.id ? (user.email || '나').split('@')[0] : '알 수 없음');
    return {
      nickname,
      seal_text: p?.seal_text || Array.from(nickname)[0] || '?',
      seal_color: p?.seal_color || 'ink',
      seal_style: p?.seal_style || 'solid',
    };
  };
  const nameOf = (userId: string) => profileOf(userId).nickname;

  const myReviews = allReviews.filter((r) => r.user_id === user?.id);
  const activeReview = allReviews.find((r) => r.id === activeId) ?? null;
  const activeClip = clippings.find((c) => c.id === activeClipId) ?? null;
  const isOwner = !!activeReview && activeReview.user_id === user?.id;
  const otherReviews = activeReview
    ? allReviews.filter((r) => r.book_isbn === activeReview.book_isbn && r.id !== activeReview.id)
    : [];

  const loadData = useCallback(async (u: User) => {
    const reviewsRes = await supabase
      .from('reviews')
      .select(
        'id, user_id, book_isbn, rating, status, content, created_at, books(title, author, cover_url), quotes(id, content, created_at, quote_comments(id, content, created_at))'
      )
      .order('created_at', { ascending: false });

    // 인장 컬럼이 아직 없으면 닉네임만 불러옴
    let profilesRes: any = await supabase
      .from('profiles')
      .select('id, nickname, seal_text, seal_color, seal_style');
    if (profilesRes.error) {
      profilesRes = await supabase.from('profiles').select('id, nickname');
    }

    if (reviewsRes.error) console.error('reviews 에러:', reviewsRes.error.message);
    if (profilesRes.error) console.error('profiles 에러:', profilesRes.error.message);

    const map: Record<string, Profile> = {};
    (profilesRes.data || []).forEach((p: any) => {
      map[p.id] = {
        nickname: p.nickname,
        seal_text: p.seal_text ?? null,
        seal_color: p.seal_color ?? null,
        seal_style: p.seal_style ?? null,
      };
    });

    // 내 프로필이 없으면 이메일 앞부분으로 자동 생성
    if (!profilesRes.error && !map[u.id]) {
      const nick = (u.email || '사용자').split('@')[0];
      await supabase
        .from('profiles')
        .upsert({ id: u.id, nickname: nick }, { onConflict: 'id', ignoreDuplicates: true });
      map[u.id] = { nickname: nick, seal_text: null, seal_color: null, seal_style: null };
    }
    setProfiles(map);

    // 내 스크랩 (형광펜, 각주 포함)
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
        (clipRes.data as any[]).map((c) => ({
          ...c,
          clip_highlights: (c.clip_highlights || []).sort(byCreated),
          clip_notes: (c.clip_notes || []).sort(byCreated),
        })) as Clipping[]
      );
    }

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

  // 스크랩 읽기 화면에서 선택한 글자의 위치를 기억해 둠 (버튼을 눌러도 선택이 풀리지 않게)
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
    setClippings([]);
    setActiveId(null);
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

    setProfileSaving(true);
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        nickname: nick,
        seal_text: sealText || null,
        seal_color: draft.sealColor,
        seal_style: draft.sealStyle,
      },
      { onConflict: 'id' }
    );
    setProfileSaving(false);

    if (error) {
      if (error.message.includes('seal_')) {
        return alert('인장 저장에 필요한 컬럼이 아직 없어요. Supabase에서 안내드린 SQL을 먼저 실행해 주세요.');
      }
      return alert(`프로필 저장 실패: ${error.message}`);
    }
    await refresh();
    setProfileMsg('저장했어요.');
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
          rating: regStatus === 'completed' ? rating : 0,
          status: regStatus,
          content: '',
        })
        .select()
        .single();
      if (reviewError) throw reviewError;

      setSelectedBook(null);
      setRating(0);
      setRegStatus('completed');
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
  const handleUpdateStatus = async (nextStatus: Status, nextRating: number) => {
    if (!activeReview || !isOwner) return;
    const savedRating = nextStatus === 'completed' ? nextRating : 0;

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

  // ---------- 스크랩 ----------
  const openClip = (id: string) => {
    setActiveClipId(id);
    setSelection(null);
    setNotePanelOpen(false);
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
    await refresh();
    openClip(data.id);
  };

  // 기사 링크로 제목과 본문을 자동으로 불러옴 (서버의 /api/clips/fetch 를 거침)
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
    } catch (err: any) {
      setClipFetchError(`${err.message} 본문을 직접 붙여넣어 주세요.`);
    } finally {
      setClipFetching(false);
    }
  };

  // 링크를 붙여넣으면 (본문이 비어 있을 때) 바로 불러옴
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

  // 선택한 문장에 형광펜(빨강/파랑) 또는 지우개
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

  // 선택한 문장에 각주 코멘트
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

  const handleClearHighlights = async () => {
    if (!activeClip || !confirm('이 스크랩의 형광펜을 모두 지우시겠습니까?')) return;
    const { error } = await supabase.from('clip_highlights').delete().eq('clipping_id', activeClip.id);
    if (error) return alert(`삭제 실패: ${error.message}`);
    setClippings((prev) => prev.map((c) => (c.id === activeClip.id ? { ...c, clip_highlights: [] } : c)));
  };

  const handleDeleteClipping = async () => {
    if (!activeClip || !confirm('이 스크랩과 형광펜, 코멘트를 모두 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('clippings').delete().eq('id', activeClip.id);
    if (error) return alert(`삭제 실패: ${error.message}`);
    setActiveClipId(null);
    clearSelection();
    refresh();
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
    setActiveSeries(null);
    setActiveClipId(null);
    setSelection(null);
    setNotePanelOpen(false);
    if (t === 'profile' && user) {
      const p = profiles[user.id];
      setDraft({
        nickname: profileOf(user.id).nickname,
        sealText: p?.seal_text ?? '',
        sealColor: p?.seal_color || 'ink',
        sealStyle: p?.seal_style || 'solid',
      });
      setProfileMsg('');
    }
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
  const mySeal = profileOf(user.id);

  // 인장 + 닉네임
  const renderByline = (userId: string, size = 18, className = '') => {
    const p = profileOf(userId);
    return (
      <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
        <Seal text={p.seal_text} color={p.seal_color} styleType={p.seal_style} size={size} />
        <span className="truncate">{p.nickname}</span>
      </span>
    );
  };

  const navTabs: [Tab, string][] = [
    ['mine', '내 서재'],
    ['community', '전체 서재'],
  ];
  const navButton = (t: Tab, label: string, extra = '') => (
    <button
      key={t}
      onClick={() => goTab(t)}
      className={`min-h-[44px] px-3 text-xs font-semibold tracking-widest transition-colors duration-200 ${FOCUS} ${
        tab === t ? 'bg-[#111111] text-[#F9F9F7]' : 'hover:text-[#CC0000]'
      } ${extra}`}
    >
      {label}
    </button>
  );

  const header = (
    <header className="md:sticky md:top-0 z-40 bg-[#F9F9F7] border-b-4 border-[#111111]">
      <div className="bg-[#111111] text-[#F9F9F7]">
        <div className="max-w-screen-xl mx-auto px-4 py-1 flex justify-between gap-3 text-[11px] uppercase tracking-widest">
          <span className="truncate">Vol. 1 &middot; {today}</span>
          <span className="hidden sm:inline shrink-0">The Reading Edition</span>
        </div>
      </div>
      <div className="max-w-screen-xl mx-auto px-4 flex flex-wrap items-center justify-between gap-x-4">
        <div className="order-1 flex items-center gap-4 sm:gap-6 min-w-0">
          <button onClick={() => goTab('mine')} className={FOCUS}>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter leading-none py-2">ReadPot</h1>
          </button>
          {/* 화면이 넓을 때: 제호 옆에 탭 */}
          <nav className="hidden sm:flex">{navTabs.map(([t, label]) => navButton(t, label))}</nav>
        </div>

        <div className="order-2 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => goTab('profile')}
            title="프로필 편집"
            className={`inline-flex items-center gap-2 min-h-[44px] px-1 sm:px-2 text-xs font-semibold tracking-widest transition-colors duration-200 ${FOCUS} ${
              tab === 'profile' ? 'underline decoration-2 decoration-[#CC0000] underline-offset-8' : 'hover:text-[#CC0000]'
            }`}
          >
            <Seal text={mySeal.seal_text} color={mySeal.seal_color} styleType={mySeal.seal_style} size={26} />
            <span className="hidden sm:inline">{mySeal.nickname}</span>
          </button>
          <button onClick={handleLogout} className={`${BTN_OUTLINE} !min-h-[40px] !px-3`}>
            로그아웃
          </button>
        </div>

        {/* 모바일: 제호 아래에 탭을 가로로 꽉 채움 */}
        <nav className="order-3 w-full sm:hidden grid grid-cols-2 border-t border-[#111111]">
          {navTabs.map(([t, label]) => navButton(t, label, 'justify-center'))}
        </nav>
      </div>
    </header>
  );

  // ---------- 게시판 표 ----------
  const asRows = (list: Review[]): CommunityEntry[] =>
    list.map((review) => ({ type: 'review', review }));

  const openSeries = (entry: SeriesEntry) => {
    setActiveSeries(entry.key);
    setActiveVolume(entry.volumes[0].volume);
    window.scrollTo({ top: 0 });
  };

  const renderBoard = (rows: CommunityEntry[], showAuthor: boolean) => {
    const col = showAuthor
      ? { title: 'sm:col-span-4', author: 'sm:col-span-2', nick: 'sm:col-span-3', status: 'sm:col-span-2', date: 'sm:col-span-1' }
      : { title: 'sm:col-span-6', author: 'sm:col-span-3', nick: '', status: 'sm:col-span-2', date: 'sm:col-span-1' };
    const rowClass =
      'grid grid-cols-12 gap-3 items-center px-5 py-3 border-b border-[#111111] last:border-b-0 hover:bg-[#F5F5F5] cursor-pointer transition-colors duration-200 group';
    const coverClass =
      'w-9 h-12 object-cover border border-[#111111] bg-[#E5E5E5] grayscale transition duration-200 group-hover:sepia-[50%] shrink-0';
    const titleClass =
      'font-bold text-sm truncate underline-offset-4 decoration-2 decoration-[#CC0000] group-hover:underline';

    return (
      <>
        {/* 검정으로 반전된 표 머리글 */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2 bg-[#111111] text-[#F9F9F7] text-[11px] font-semibold uppercase tracking-widest">
          <span className={col.title}>책 제목</span>
          <span className={col.author}>저자</span>
          {showAuthor && <span className={col.nick}>작성자</span>}
          <span className={`${col.status} text-center`}>상태 / 별점</span>
          <span className={`${col.date} text-right`}>날짜</span>
        </div>

        <ul>
          {rows.map((row) => {
            if (row.type === 'series') {
              const userIds = Array.from(new Set(row.reviews.map((r) => r.user_id)));
              return (
                <li key={`series-${row.key}`} onClick={() => openSeries(row)} className={rowClass}>
                  <div className={`col-span-12 ${col.title} flex items-center gap-3 min-w-0`}>
                    <img
                      src={row.cover || undefined}
                      alt={row.base}
                      className={coverClass}
                    />
                    <span className="min-w-0">
                      <span className={`block ${titleClass}`}>{row.base}</span>
                      <span className="block text-[11px] text-[#737373]">
                        시리즈 &middot; 기록된 {row.volumes.length}권
                      </span>
                    </span>
                  </div>
                  <span className={`col-span-6 ${col.author} text-xs text-[#525252] truncate`}>
                    {row.author}
                  </span>
                  {showAuthor && (
                    <span className={`col-span-6 ${col.nick} text-xs font-semibold min-w-0 flex items-center gap-1`}>
                      {renderByline(userIds[0], 18)}
                      {userIds.length > 1 && (
                        <span className="shrink-0 text-[#737373]">외 {userIds.length - 1}명</span>
                      )}
                    </span>
                  )}
                  <div className={`col-span-6 ${col.status} flex sm:justify-center`}>
                    <span className="inline-block bg-[#111111] px-2 py-0.5 text-[11px] font-semibold tracking-widest text-[#F9F9F7]">
                      시리즈
                    </span>
                  </div>
                  <span className={`hidden sm:block ${col.date} text-right text-[11px] text-[#737373]`}>
                    {new Date(row.latest).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                  </span>
                </li>
              );
            }

            const rev = row.review;
            return (
              <li key={rev.id} onClick={() => openReview(rev)} className={rowClass}>
                <div className={`col-span-12 ${col.title} flex items-center gap-3 min-w-0`}>
                  <img
                    src={rev.books.cover_url || undefined}
                    alt={rev.books.title}
                    className={coverClass}
                  />
                  <span className={titleClass}>{rev.books.title}</span>
                </div>
                <span className={`col-span-6 ${col.author} text-xs text-[#525252] truncate`}>
                  {rev.books.author}
                </span>
                {showAuthor && (
                  <span className={`col-span-6 ${col.nick} text-xs font-semibold min-w-0`}>
                    {renderByline(rev.user_id, 18)}
                  </span>
                )}
                <div className={`col-span-6 ${col.status} flex sm:justify-center`}>
                  <StatusCell review={rev} size={13} />
                </div>
                <span className={`hidden sm:block ${col.date} text-right text-[11px] text-[#737373]`}>
                  {new Date(rev.created_at).toLocaleDateString('ko-KR', {
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      </>
    );
  };

  // ---------- 상세 화면 ----------
  if (activeReview) {
    const hasQuotes = (activeReview.quotes?.length || 0) > 0;
    const showReview = (isEditingContent && isOwner) || !!activeReview.content;
    const showQuotes = isOwner || hasQuotes;
    // 읽고 싶은 책으로만 담아 둔 사람은 '읽은 사람'에 넣지 않음
    const readers = otherReviews.filter((r) => r.status !== 'wishlist');
    const hasSidebar = readers.length > 0;

    return (
      <div className="min-h-screen text-[#111111]">
        <GlobalStyle />
        {header}
        <main className="max-w-screen-xl mx-auto px-4 py-8 space-y-4">
          <button onClick={() => setActiveId(null)} className={`${LINK_BTN} min-h-[44px]`}>
            &larr; 목록으로 돌아가기
          </button>

          <article className="border border-[#111111] bg-[#F9F9F7]">
            {/* 책 정보 블록: 우측 상단에 읽고 싶은 책 / 읽는 중 / 독후감 추가 버튼 */}
            <section className="p-5 md:p-6 border-b-4 border-[#111111]">
              <div className="flex gap-4 sm:gap-5">
                <img
                  src={activeReview.books.cover_url || undefined}
                  alt={activeReview.books.title}
                  className="w-20 h-28 sm:w-24 sm:h-36 object-cover border border-[#111111] bg-[#E5E5E5] grayscale transition duration-200 hover:sepia-[50%] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#737373]">
                        {renderByline(activeReview.user_id, 20, 'font-semibold text-[#111111]')}
                        <span>&middot; {new Date(activeReview.created_at).toLocaleDateString('ko-KR')}</span>
                      </p>
                      <h2 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight break-words">
                        {activeReview.books.title}
                      </h2>
                      <p className="mt-1 text-sm text-[#525252]">{activeReview.books.author}</p>
                    </div>

                    {isOwner && (
                      <div className="flex flex-wrap gap-2 max-w-full">
                        <ToggleButton
                          pressed={activeReview.status === 'wishlist'}
                          onClick={() =>
                            handleUpdateStatus(
                              activeReview.status === 'wishlist' ? 'completed' : 'wishlist',
                              activeReview.rating
                            )
                          }
                        >
                          읽고 싶은 책
                        </ToggleButton>
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
                          <button onClick={startWritingReview} className={BTN_OUTLINE}>
                            독후감 추가
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    {isOwner ? (
                      activeReview.status === 'completed' && (
                        <RatingInput
                          value={activeReview.rating}
                          onChange={(v) => handleUpdateStatus('completed', v)}
                          size={26}
                        />
                      )
                    ) : activeReview.status === 'completed' ? (
                      <div className="flex items-center gap-2">
                        <RatingDisplay value={activeReview.rating} size={22} />
                        <span className="text-sm font-semibold">{activeReview.rating}점</span>
                      </div>
                    ) : (
                      <StatusCell review={activeReview} />
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
                      <span className="text-sm font-semibold text-[#737373]">({readers.length})</span>
                    </h3>
                    <ToggleButton pressed={showOthers} onClick={() => setShowOthers(!showOthers)}>
                      함께 보기
                    </ToggleButton>
                  </div>

                  {showOthers &&
                    readers.map((o) => (
                      <div key={o.id} className="border-t border-[#111111] pt-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm min-w-0">{renderByline(o.user_id, 22)}</span>
                          <StatusCell review={o} size={14} />
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

  // ---------- 스크랩 읽기 화면 ----------
  if (activeClip) {
    const notes = sortNotes(activeClip.clip_notes);
    const isUrl = !!activeClip.source && /^https?:\/\//i.test(activeClip.source);
    const swatches: { key: 'red' | 'blue' | 'erase'; label: string; color: string }[] = [
      { key: 'red', label: '빨간색', color: '#CC0000' },
      { key: 'blue', label: '파란색', color: '#0047CC' },
      { key: 'erase', label: '지우개', color: '#FFFFFF' },
    ];
    const keepSelection = (e: React.MouseEvent) => e.preventDefault(); // 버튼을 눌러도 선택이 풀리지 않게

    const sideBtn = `flex w-full items-center gap-2 min-h-[44px] px-3 border border-[#111111] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-[#111111] hover:text-[#F9F9F7] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
    const barBtn = `flex flex-col items-center justify-center gap-1 min-h-[52px] min-w-0 border border-[#111111] text-[11px] font-semibold transition-all duration-200 active:bg-[#111111] active:text-[#F9F9F7] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;

    // 코멘트 입력창 (PC 옆 패널 / 모바일 하단 막대에서 같이 씀)
    const noteForm = (variant: 'side' | 'bar') =>
      selection && notePanelOpen ? (
        <form
          onSubmit={handleAddNote}
          className={
            variant === 'side'
              ? 'space-y-2 border-t border-[#111111] pt-3'
              : 'px-3 py-3 space-y-2 border-b border-[#111111]'
          }
        >
          {variant === 'bar' && (
            <p className="text-xs font-bold italic max-h-[2.6em] overflow-hidden break-words">
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
              className={`${INPUT} leading-relaxed`}
            />
          ) : (
            <input
              type="text"
              autoFocus
              value={noteDraftText}
              onChange={(e) => setNoteDraftText(e.target.value)}
              placeholder="이 문장에 대한 의견"
              className={INPUT}
            />
          )}
          <div className="flex gap-2">
            <button type="submit" className={`${BTN_SM} flex-1`}>
              등록
            </button>
            <button
              type="button"
              onClick={() => setNotePanelOpen(false)}
              className={`${BTN_OUTLINE} !min-h-[36px] !px-3 flex-1`}
            >
              취소
            </button>
          </div>
        </form>
      ) : null;

    return (
      <div className="min-h-screen text-[#111111]">
        <GlobalStyle />
        {header}
        <main className="mx-auto max-w-3xl lg:max-w-[66rem] px-4 py-6 md:py-8 pb-56 lg:pb-8">
          <button
            onClick={() => {
              setActiveClipId(null);
              clearSelection();
            }}
            className={`${LINK_BTN} min-h-[44px]`}
          >
            &larr; 내 서재로 돌아가기
          </button>

          <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
            <article className="min-w-0 border border-[#111111] bg-[#F9F9F7]">
              <section className="p-5 md:p-8 border-b-4 border-[#111111] space-y-3">
                <p className="text-[11px] uppercase tracking-widest text-[#737373]">Clipping</p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight break-words">
                  {activeClip.title}
                </h2>
                <p className="text-xs text-[#737373] flex flex-wrap gap-x-3 gap-y-1">
                  {activeClip.source &&
                    (isUrl ? (
                      <a
                        href={activeClip.source}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline decoration-2 decoration-[#CC0000] underline-offset-4 break-all"
                      >
                        {activeClip.source}
                      </a>
                    ) : (
                      <span className="break-words">{activeClip.source}</span>
                    ))}
                  <span>{new Date(activeClip.created_at).toLocaleDateString('ko-KR')}</span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  {activeClip.clip_highlights.length > 0 && (
                    <button onClick={handleClearHighlights} className={`${DANGER_BTN} min-h-[36px]`}>
                      형광펜 전체 지우기
                    </button>
                  )}
                  <button onClick={handleDeleteClipping} className={`${DANGER_BTN} min-h-[36px]`}>
                    스크랩 삭제
                  </button>
                </div>
              </section>

              <section className="p-5 md:p-8">
                <ClipArticle
                  content={activeClip.content}
                  highlights={activeClip.clip_highlights}
                  notes={activeClip.clip_notes}
                  containerRef={articleRef}
                />
              </section>

              {/* 각주: 문장 + 의견을 인용문처럼 */}
              {notes.length > 0 && (
                <section className="p-5 md:p-8 border-t-4 border-[#111111]">
                  <h3 className="text-xl font-black tracking-tight">
                    각주{' '}
                    <span className="text-sm font-semibold text-[#737373]">({notes.length})</span>
                  </h3>
                  <div className="mt-4 divide-y divide-[#E5E5E0]">
                    {notes.map((n, i) => (
                      <div key={n.id} id={`note-${n.id}`} className="py-4 first:pt-0">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0 text-base font-bold italic leading-relaxed whitespace-pre-line break-words">
                            <span className="not-italic mr-1.5 text-xs font-black">{i + 1})</span>
                            &quot;{n.quote_text}&quot;
                          </div>
                          <button onClick={() => handleDeleteNote(n.id)} className={`${DANGER_BTN} shrink-0`}>
                            삭제
                          </button>
                        </div>
                        <div className="mt-2 ml-2 flex items-start gap-1.5 text-sm text-[#525252]">
                          <ReplyIcon />
                          <DiscordText text={n.content} className="flex-1 min-w-0 leading-relaxed" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </article>

            {/* PC: 본문 옆에 떠서 스크롤을 따라옴 */}
            <aside className="hidden lg:block lg:self-start lg:sticky lg:top-28">
              <div className="border border-[#111111] bg-[#F9F9F7]">
                <div className="px-4 py-2 bg-[#111111] text-[#F9F9F7] text-[11px] font-semibold uppercase tracking-widest">
                  도구
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className={LABEL}>형광펜</p>
                    <div className="mt-2 grid gap-2">
                      {swatches.map((b) => (
                        <button
                          key={b.key}
                          type="button"
                          disabled={!selection}
                          onMouseDown={keepSelection}
                          onClick={() => applyHighlight(b.key)}
                          className={sideBtn}
                        >
                          <span
                            className="inline-block w-4 h-4 border border-[#111111]"
                            style={{ background: b.color }}
                          />
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#111111] pt-4 space-y-3">
                    <p className={LABEL}>선택한 문장</p>
                    <p className="text-xs text-[#525252] break-words max-h-32 overflow-y-auto">
                      {selection ? `"${selection.text}"` : '문장을 드래그해서 선택하세요'}
                    </p>
                    {selection && (
                      <button type="button" onClick={clearSelection} className={LINK_BTN}>
                        선택 해제
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!selection}
                      onMouseDown={keepSelection}
                      onClick={() => setNotePanelOpen(true)}
                      className={`${BTN} w-full`}
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

        {/* 모바일: 화면 아래에 고정 */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#F9F9F7] border-t-4 border-[#111111] pb-[env(safe-area-inset-bottom)]">
          {noteForm('bar')}
          <div className="px-3 pt-2 flex items-center gap-3 text-xs">
            <span className="flex-1 min-w-0 truncate text-[#737373]">
              {selection ? `선택: "${selection.text}"` : '문장을 드래그해서 선택하세요'}
            </span>
            {selection && (
              <button type="button" onClick={clearSelection} className={`${LINK_BTN} shrink-0`}>
                해제
              </button>
            )}
          </div>
          <div className="px-3 pb-2 pt-1.5 grid grid-cols-4 gap-1.5">
            {swatches.map((b) => (
              <button
                key={b.key}
                type="button"
                disabled={!selection}
                onMouseDown={keepSelection}
                onClick={() => applyHighlight(b.key)}
                className={barBtn}
              >
                <span className="inline-block w-4 h-4 border border-[#111111]" style={{ background: b.color }} />
                <span>{b.label}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={!selection}
              onMouseDown={keepSelection}
              onClick={() => setNotePanelOpen(true)}
              className={`${barBtn} bg-[#111111] text-[#F9F9F7]`}
            >
              <span className="text-base font-black leading-none">+</span>
              <span>코멘트</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- 프로필 (닉네임 + 인장) ----------
  if (tab === 'profile') {
    const completedCount = myReviews.filter((r) => r.status === 'completed').length;
    const readingCount = myReviews.filter((r) => r.status === 'reading').length;
    const wishCount = myReviews.filter((r) => r.status === 'wishlist').length;
    const quoteCount = myReviews.reduce((sum, r) => sum + (r.quotes?.length || 0), 0);

    const previewNick = draft.nickname.trim() || '닉네임';
    const previewSeal =
      Array.from(draft.sealText.trim()).slice(0, 2).join('') || Array.from(previewNick)[0] || '?';

    const stats: [string, number][] = [
      ['읽은 책', completedCount],
      ['읽는 중', readingCount],
      ['읽고 싶은 책', wishCount],
      ['모은 인용문', quoteCount],
    ];

    return (
      <div className="min-h-screen text-[#111111]">
        <GlobalStyle />
        {header}
        <main className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="border border-[#111111] bg-[#F9F9F7] grid grid-cols-1 lg:grid-cols-12">
            {/* 왼쪽 5칸: 편집 */}
            <section className="lg:col-span-5 p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-[#111111] space-y-6">
              <div className="border-b-2 border-[#111111] pb-2">
                <p className="text-[11px] uppercase tracking-widest text-[#737373]">Profile</p>
                <h2 className="text-xl font-black tracking-tight">닉네임과 인장</h2>
              </div>

              <div>
                <label className={LABEL}>닉네임</label>
                <input
                  type="text"
                  value={draft.nickname}
                  onChange={(e) =>
                    setDraft({ ...draft, nickname: Array.from(e.target.value).slice(0, 16).join('') })
                  }
                  placeholder="다른 사람에게 보이는 이름"
                  className={INPUT}
                />
                <p className="mt-1 text-xs text-[#737373]">
                  {Array.from(draft.nickname).length}/16 &middot; 다른 사람과 겹치면 쓸 수 없어요.
                </p>
              </div>

              <div>
                <label className={LABEL}>인장 글자</label>
                <input
                  type="text"
                  value={draft.sealText}
                  onChange={(e) =>
                    setDraft({ ...draft, sealText: Array.from(e.target.value).slice(0, 2).join('') })
                  }
                  placeholder="비우면 닉네임 첫 글자"
                  className={INPUT}
                />
                <p className="mt-1 text-xs text-[#737373]">1~2글자까지 새길 수 있어요.</p>
              </div>

              <div>
                <label className={LABEL}>인장 색</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(SEAL_COLORS).map(([key, c]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={draft.sealColor === key}
                      onClick={() => setDraft({ ...draft, sealColor: key })}
                      className={`inline-flex items-center gap-2 min-h-[44px] px-4 border border-[#111111] text-xs font-semibold tracking-widest transition-colors duration-200 ${FOCUS} ${
                        draft.sealColor === key ? 'bg-[#111111] text-[#F9F9F7]' : 'hover:bg-[#F5F5F5]'
                      }`}
                    >
                      <span
                        className="inline-block w-4 h-4 border border-[#A3A3A3]"
                        style={{ background: c.hex }}
                      />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={LABEL}>인장 모양</label>
                <div className="mt-2 flex flex-wrap gap-2">
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

              <div className="flex items-center gap-4 pt-2 border-t border-[#111111]">
                <button onClick={handleSaveProfile} disabled={profileSaving} className={`${BTN} mt-4`}>
                  {profileSaving ? '저장 중...' : '저장'}
                </button>
                {profileMsg && <span className="mt-4 text-xs font-semibold">{profileMsg}</span>}
              </div>
            </section>

            {/* 오른쪽 7칸: 미리보기 + 기록 */}
            <section className="lg:col-span-7">
              <div className="px-5 py-4 border-b-4 border-[#111111]">
                <p className="text-[11px] uppercase tracking-widest text-[#737373]">Preview</p>
                <h2 className="text-3xl font-black tracking-tight">미리보기</h2>
              </div>

              <div className="p-5 md:p-6 space-y-6">
                <div className="flex items-center gap-5">
                  <Seal text={previewSeal} color={draft.sealColor} styleType={draft.sealStyle} size={88} />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-widest text-[#737373]">Reader</p>
                    <p className="text-3xl font-black tracking-tight truncate">{previewNick}</p>
                  </div>
                </div>

                <div className="border-t border-[#111111] pt-4 space-y-2">
                  <p className={LABEL}>이렇게 보여요</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Seal text={previewSeal} color={draft.sealColor} styleType={draft.sealStyle} size={18} />
                      {previewNick}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#737373]">
                      <Seal text={previewSeal} color={draft.sealColor} styleType={draft.sealStyle} size={22} />
                      <span>
                        {previewNick} &middot; {today}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-[#737373]">
                    인장은 전체 서재 목록, 글 상세 화면, 같은 책을 읽은 사람 목록에서 닉네임 옆에 찍혀요.
                  </p>
                </div>

                <div>
                  <p className={LABEL}>나의 기록</p>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 border-t border-l border-[#111111]">
                    {stats.map(([label, n]) => (
                      <div key={label} className="p-4 border-r border-b border-[#111111]">
                        <p className="text-3xl font-black tracking-tight">{n}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-widest text-[#737373]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ---------- 전체 서재 (모든 유저의 글, 읽고 싶은 책은 제외, 시리즈는 묶어서) ----------
  if (tab === 'community') {
    const published = allReviews.filter((r) => r.status !== 'wishlist');

    // 시리즈 화면: 권을 골라서 봄
    const series = activeSeries
      ? buildCommunityEntries(published).find(
          (e): e is SeriesEntry => e.type === 'series' && e.key === activeSeries
        )
      : undefined;

    if (series) {
      const vol = series.volumes.find((v) => v.volume === activeVolume) ?? series.volumes[0];

      return (
        <div className="min-h-screen text-[#111111]">
          <GlobalStyle />
          {header}
          <main className="max-w-screen-xl mx-auto px-4 py-8 space-y-4">
            <button onClick={() => setActiveSeries(null)} className={`${LINK_BTN} min-h-[44px]`}>
              &larr; 전체 서재로 돌아가기
            </button>

            <section className="border border-[#111111] bg-[#F9F9F7]">
              <div className="px-5 py-4 border-b-4 border-[#111111] flex items-center gap-4">
                <img
                  src={series.cover || undefined}
                  alt={series.base}
                  className="w-14 h-20 object-cover border border-[#111111] bg-[#E5E5E5] grayscale shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-widest text-[#737373]">Series</p>
                  <h2 className="text-3xl font-black tracking-tight">{series.base}</h2>
                  <p className="text-sm text-[#525252]">
                    {series.author} &middot; 기록된 {series.volumes.length}권
                  </p>
                </div>
              </div>

              {/* 권 선택 */}
              <div className="px-5 py-3 border-b border-[#111111] flex flex-wrap items-center gap-2">
                <span className={`${LABEL} mr-1`}>권 선택</span>
                {series.volumes.map((v) => (
                  <ToggleButton
                    key={v.volume}
                    pressed={v.volume === vol.volume}
                    onClick={() => setActiveVolume(v.volume)}
                  >
                    {v.label}
                  </ToggleButton>
                ))}
              </div>

              {renderBoard(asRows(vol.reviews), true)}
            </section>
          </main>
          <Footer />
        </div>
      );
    }

    const entries = buildCommunityEntries(published.filter(matchesFilter));

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
                  <span className="text-sm font-semibold text-[#737373]">총 {published.length}개의 기록</span>
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

            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#737373]">
                <p className="text-sm">
                  {published.length === 0 ? '아직 올라온 글이 없습니다.' : '검색 결과가 없습니다.'}
                </p>
              </div>
            ) : (
              renderBoard(entries, true)
            )}
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // ---------- 내 서재 ----------
  const myShelf = myReviews.filter((r) => r.status !== 'wishlist');
  const myWishlist = myReviews.filter((r) => r.status === 'wishlist');
  const shelfList = myShelf.filter(matchesFilter);
  const wishList = myWishlist.filter(matchesFilter);
  const filterQ = boardFilter.trim().toLowerCase();
  const clipList = clippings.filter(
    (c) => !filterQ || `${c.title} ${c.source || ''}`.toLowerCase().includes(filterQ)
  );

  return (
    <div className="min-h-screen text-[#111111]">
      <GlobalStyle />
      {header}
      <main className="max-w-screen-xl mx-auto px-4 py-6 md:py-8">
        <div className="border border-[#111111] bg-[#F9F9F7] grid grid-cols-1 lg:grid-cols-12">
          {/* 왼쪽 4칸: 새 글 만들기 (책 / 스크랩) */}
          <section className="lg:col-span-4 min-w-0 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-[#111111] space-y-5">
            <div className="border-b-2 border-[#111111] pb-2">
              <p className="text-[11px] uppercase tracking-widest text-[#737373]">New Entry</p>
              <h2 className="text-xl font-black tracking-tight">새 글 만들기</h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ToggleButton pressed={newKind === 'book'} onClick={() => setNewKind('book')} className="w-full">
                책 검색
              </ToggleButton>
              <ToggleButton pressed={newKind === 'clip'} onClick={() => setNewKind('clip')} className="w-full">
                스크랩
              </ToggleButton>
            </div>

            {newKind === 'book' ? (
              <>
                <form onSubmit={handleSearch} className="flex gap-2 items-end">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="책 제목 또는 저자 검색..."
                    className={`${INPUT} flex-1`}
                  />
                  <button type="submit" disabled={searchLoading} className={`${BTN} shrink-0`}>
                    {searchLoading ? '검색 중' : '검색'}
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
                        <button
                          onClick={() => setSelectedBook(book)}
                          className={`${BTN_OUTLINE} !min-h-[36px] !px-3 shrink-0`}
                        >
                          선택
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedBook && (
                  <div className="border-2 border-[#111111] p-4 space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black tracking-tight">새 책 서재에 추가</h3>
                      <button onClick={() => setSelectedBook(null)} className={`${DANGER_BTN} shrink-0`}>
                        다시 선택
                      </button>
                    </div>

                    <div className="flex items-center gap-3 border-y border-[#111111] py-3">
                      <img
                        src={selectedBook.thumbnail || undefined}
                        alt={selectedBook.title}
                        className="w-12 h-16 object-cover border border-[#111111] bg-[#E5E5E5] grayscale shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-sm break-words">{selectedBook.title}</p>
                        <p className="text-xs text-[#525252] truncate">{selectedBook.authors.join(', ')}</p>
                      </div>
                    </div>

                    <form onSubmit={handleSubmitReview} className="space-y-5">
                      <div className="grid grid-cols-2 gap-2">
                        <ToggleButton
                          className="w-full"
                          pressed={regStatus === 'wishlist'}
                          onClick={() => setRegStatus(regStatus === 'wishlist' ? 'completed' : 'wishlist')}
                        >
                          읽고 싶은 책
                        </ToggleButton>
                        <ToggleButton
                          className="w-full"
                          pressed={regStatus === 'reading'}
                          onClick={() => setRegStatus(regStatus === 'reading' ? 'completed' : 'reading')}
                        >
                          읽는 중
                        </ToggleButton>
                      </div>

                      {regStatus === 'completed' && (
                        <div>
                          <label className={LABEL}>별점</label>
                          <div className="mt-2">
                            <RatingInput value={rating} onChange={setRating} size={26} />
                          </div>
                        </div>
                      )}

                      <button type="submit" className={`${BTN} w-full`}>
                        {regStatus === 'wishlist' ? '읽고 싶은 책에 담기' : '내 서재에 등록하기'}
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={handleSaveClipping} className="space-y-5">
                <div>
                  <label className={LABEL}>기사 링크 (선택)</label>
                  <div className="flex gap-2 items-end">
                    <input
                      type="text"
                      inputMode="url"
                      value={clipSource}
                      onChange={(e) => setClipSource(e.target.value)}
                      onPaste={handleClipLinkPaste}
                      placeholder="링크를 붙여넣으면 본문을 불러와요"
                      className={`${INPUT} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => fetchArticle(clipSource)}
                      disabled={clipFetching || !clipSource.trim()}
                      className={`${BTN_OUTLINE} shrink-0`}
                    >
                      {clipFetching ? '불러오는 중' : '불러오기'}
                    </button>
                  </div>
                  {clipFetchError && (
                    <p className="mt-1 text-xs font-semibold text-[#CC0000] break-words">{clipFetchError}</p>
                  )}
                  <p className="mt-1 text-xs text-[#737373]">
                    링크 대신 매체 이름을 적어도 돼요. 일부 사이트는 불러오지 못할 수 있어요.
                  </p>
                </div>

                <div>
                  <label className={LABEL}>제목</label>
                  <input
                    type="text"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    placeholder="비우면 본문 첫 줄을 제목으로 써요"
                    className={INPUT}
                  />
                </div>

                <div>
                  <label className={LABEL}>본문</label>
                  <textarea
                    rows={12}
                    value={clipContent}
                    onChange={(e) => setClipContent(e.target.value)}
                    placeholder="기사나 칼럼을 복사해서 붙여넣어도 돼요"
                    className={`${TEXTAREA_BOX} mt-2`}
                  />
                  <p className="mt-1 text-xs text-[#737373]">
                    저장한 뒤에는 본문을 고칠 수 없어요. 형광펜과 각주 위치가 어긋나기 때문이에요. 불필요한
                    부분은 저장 전에 지워 주세요.
                  </p>
                </div>

                <button type="submit" disabled={clipSaving} className={`${BTN} w-full`}>
                  {clipSaving ? '저장 중...' : '스크랩 저장'}
                </button>
              </form>
            )}
          </section>

          {/* 오른쪽 8칸: 내 서재 + 읽고 싶은 책 + 스크랩 */}
          <div className="lg:col-span-8 min-w-0">
            <section>
              <div className="flex flex-wrap justify-between items-end gap-3 px-4 sm:px-5 py-4 border-b-4 border-[#111111]">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-[#737373]">My Shelf</p>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                    내 서재{' '}
                    <span className="text-sm font-semibold text-[#737373]">총 {myShelf.length}권</span>
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

              {shelfList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-[#737373]">
                  <p className="text-sm">
                    {myShelf.length === 0
                      ? '등록된 책이 없습니다. "새 글 만들기"에서 책을 검색해 첫 글을 만들어 보세요.'
                      : '검색 결과가 없습니다.'}
                  </p>
                </div>
              ) : (
                renderBoard(asRows(shelfList), false)
              )}
            </section>

            {/* 읽고 싶은 책 칸 */}
            <section className="border-t-4 border-[#111111]">
              <div className="px-4 sm:px-5 py-4 border-b-4 border-[#111111]">
                <p className="text-[11px] uppercase tracking-widest text-[#737373]">Wish List</p>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  읽고 싶은 책{' '}
                  <span className="text-sm font-semibold text-[#737373]">총 {myWishlist.length}권</span>
                </h2>
              </div>

              {wishList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-[#737373]">
                  <p className="text-sm">
                    {myWishlist.length === 0
                      ? '읽고 싶은 책이 없습니다. 책을 검색해 "읽고 싶은 책"으로 담아 보세요.'
                      : '검색 결과가 없습니다.'}
                  </p>
                </div>
              ) : (
                renderBoard(asRows(wishList), false)
              )}
            </section>

            {/* 스크랩 칸 */}
            <section className="border-t-4 border-[#111111]">
              <div className="px-4 sm:px-5 py-4 border-b-4 border-[#111111]">
                <p className="text-[11px] uppercase tracking-widest text-[#737373]">Clippings</p>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  스크랩{' '}
                  <span className="text-sm font-semibold text-[#737373]">총 {clippings.length}개</span>
                </h2>
              </div>

              {clipList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-[#737373]">
                  <p className="text-sm">
                    {clippings.length === 0
                      ? '스크랩이 없습니다. "새 글 만들기"에서 기사 링크나 칼럼을 추가해 보세요.'
                      : '검색 결과가 없습니다.'}
                  </p>
                </div>
              ) : (
                <ul>
                  {clipList.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => openClip(c.id)}
                      className="px-4 sm:px-5 py-4 border-b border-[#111111] last:border-b-0 hover:bg-[#F5F5F5] cursor-pointer transition-colors duration-200 group"
                    >
                      <p className="font-bold text-base break-words underline-offset-4 decoration-2 decoration-[#CC0000] group-hover:underline">
                        {c.title}
                      </p>
                      <p className="mt-1 text-xs text-[#737373] flex flex-wrap gap-x-3 gap-y-0.5">
                        {c.source && <span className="truncate max-w-full">{c.source}</span>}
                        <span>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                        <span>
                          형광펜 {c.clip_highlights.filter((h) => h.color !== 'erase').length} &middot; 각주{' '}
                          {c.clip_notes.length}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
