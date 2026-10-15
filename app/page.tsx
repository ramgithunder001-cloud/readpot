'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
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

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F2F2F2]';

const BTN = `inline-flex items-center justify-center min-h-[44px] px-4 border border-[#111111] bg-[#111111] text-[#F2F2F2] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-[#F2F2F2] hover:text-[#111111] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
const BTN_OUTLINE = `inline-flex items-center justify-center min-h-[44px] px-4 border border-[#111111] bg-transparent text-[#111111] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-[#111111] hover:text-[#F2F2F2] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
const BTN_SM = `inline-flex items-center justify-center min-h-[36px] px-3 border border-[#111111] bg-[#111111] text-[#F2F2F2] text-xs font-semibold transition-all duration-200 hover:bg-[#F2F2F2] hover:text-[#111111] ${FOCUS}`;
const BTN_ACTIVE = `inline-flex items-center justify-center min-h-[44px] px-4 border border-[#111111] bg-[#111111] text-[#F2F2F2] text-xs font-semibold tracking-widest ${FOCUS}`;
const LINK_BTN = `text-xs text-[#111111] underline-offset-4 decoration-2 decoration-[#555555] hover:underline ${FOCUS}`;
const DANGER_BTN = `text-xs text-[#525252] underline-offset-4 decoration-2 decoration-[#555555] hover:text-[#555555] hover:underline ${FOCUS}`;
const INPUT = `w-full min-w-0 bg-transparent border-0 border-b-2 border-[#111111] px-3 py-2 text-sm text-[#111111] placeholder:text-[#737373] focus:bg-[#F0F0F0] focus:outline-none`;
const TEXTAREA_BOX = `w-full bg-transparent border-0 border-b-2 border-[#111111] p-3 text-sm leading-relaxed text-[#111111] placeholder:text-[#737373] focus:bg-[#F0F0F0] focus:outline-none`;
const LABEL = 'block text-xs font-semibold uppercase tracking-widest text-[#525252]';

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
      :root {
        --paper: #F2F2F2; --paper-light: #F2F2F2; --paper-deep: #E5E5E5;
        --ink: #111111; --ink-soft: #525252; --ink-faint: #737373;
        --line: #111111; --line-dark: #111111; --rust: #555555; --rust-light: #E5E5E5;
        --olive: #111111; --olive-light: #E5E5E5; --blue: #111111; --blue-light: #E5E5E5;
        --shadow: none;
        --sans: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
        --serif: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        overflow-x: clip;
        color: var(--ink);
        background-color: var(--paper) !important;
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
        font-size: 14px;
        line-height: 1.6;
      }
      h1, h2, h3 { font-family: var(--serif); }
      body code, body pre, body pre * {
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif !important;
      }
      ::selection { background: var(--ink); color: var(--paper-light); }
      button { cursor: pointer; }
      .bs-sidebar{position:fixed;inset:0 auto 0 0;width:244px;background:#e2e2e2;border-right:1px solid var(--line);padding:27px 18px 20px;display:flex;flex-direction:column;z-index:5}
      .bs-brand{display:flex;align-items:center;gap:11px;padding:0 10px 27px;border-bottom:1px solid var(--line)}
      .bs-brand-title{font-family:var(--serif);font-size:20px;letter-spacing:-.035em;font-weight:700;line-height:1.2}
      .bs-nav{display:grid;gap:5px}
      .bs-nav button{background:transparent;border:0;text-align:left;display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:4px;color:#5a5a5a;transition:.2s}
      .bs-nav button:hover{background:rgba(255, 255, 255, .42)}
      .bs-nav button.bs-active{background:#cdcdcd;color:#2e2e2e;font-weight:700;box-shadow:inset 3px 0 var(--rust)}
      .bs-nav-count{margin-left:auto;font-family:var(--serif);font-size:12px;color:#7d7d7d}
      .bs-side-spacer{flex:1;min-height:24px}
      .bs-side-bottom{display:flex;align-items:center;gap:9px;padding:20px 8px 0;color:var(--ink-soft);font-size:11px}
      .bs-search-wrap{position:relative}
      .bs-search-wrap .bs-search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#878787;font-size:14px}
      .bs-search{width:221px;background:#f5f5f5;border:1px solid var(--line);height:36px;padding:0 12px 0 34px;color:var(--ink);border-radius:3px;font-size:12px}
      .bs-search::placeholder{color:#a4a8ae}
      .bs-icon-button{height:36px;width:36px;border:1px solid var(--line);background:var(--paper-light);color:#616161;border-radius:3px;font-size:16px;position:relative}
      .bs-content{max-width:1420px;margin:0 auto;padding:35px 42px 60px}
      .bs-eyebrow{font-size:10px;letter-spacing:.17em;color:var(--rust);font-weight:700;margin-bottom:10px;text-transform:uppercase}
      .bs-lead{color:var(--ink-soft);font-size:13px;line-height:1.9;margin:0;max-width:650px}
      .bs-page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:27px}
      .bs-page-head .bs-heading-copy{max-width:720px}
      .bs-btn{border:1px solid var(--line-dark);background:transparent;color:var(--ink);height:39px;padding:0 15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:3px;font-size:12px;transition:.18s;text-decoration:none;white-space:nowrap}
      .bs-btn:hover{background:#e9ebee}
      .bs-btn-primary{background:#34373d;border-color:#34373d;color:#fbfbfc}
      .bs-btn-primary:hover{background:#191b1f;color:#ffffff}
      .bs-records{border-top:1px solid var(--line)}
      .bs-record-row{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:15px;align-items:center;padding:17px 4px;border-bottom:1px solid var(--line)}
      .bs-record-row:hover .bs-record-title{color:var(--rust)}
      .bs-record-title{font-family:var(--serif);font-size:17px;letter-spacing:-.025em;margin-bottom:4px;transition:color .18s;cursor:pointer}
      .bs-record-excerpt{font-family:var(--serif);font-size:12px;color:#6d6d6d;line-height:1.8;margin-bottom:8px;max-width:570px}
      .bs-record-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:#888888;font-size:10px}
      .bs-meta-dot{width:3px;height:3px;border-radius:50%;background:#ababab}
      .bs-tag{display:inline-flex;align-items:center;padding:3px 7px;background:#e5e5e5;border:1px solid #d5d5d5;color:#686868;font-size:10px;border-radius:2px;white-space:nowrap}
      .bs-tag.bs-green{background:#e6e6e6;border-color:#d7d7d7;color:#626262}
      .bs-tag.bs-blue{background:#e6e6e6;border-color:#dadada;color:#686868}
      .bs-book-cover{--cover:#717171;--cover-light:#adadad;width:58px;height:78px;position:relative;display:flex;align-items:center;justify-content:center;background:var(--cover);box-shadow:2px 3px 0 rgba(49, 49, 49, .13);border-left:4px solid rgba(20, 20, 20, .14);overflow:hidden;color:#eaeaea;text-align:center;flex-shrink:0}
      .bs-book-cover:before{content:"";position:absolute;inset:6px;border:1px solid rgba(229, 229, 229, .47)}
      .bs-book-cover:after{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:rgba(0, 0, 0, .13)}
      .bs-cover-inner{position:relative;z-index:1;padding:6px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%}
      .bs-cover-title{font-family:var(--serif);font-size:11px;line-height:1.45;writing-mode:vertical-rl;max-height:50px;letter-spacing:.04em}
      .bs-cover-author{font-size:6px;letter-spacing:.06em;margin-top:4px;opacity:.8}
      .bs-shelf-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin:28px 0 20px;padding:12px;background:#eceef0;border:1px solid var(--line)}
      .bs-filter-group{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
      .bs-filter-btn{border:1px solid transparent;background:transparent;color:#757575;padding:7px 10px;font-size:11px;border-radius:2px}
      .bs-filter-btn.bs-active{border-color:#bbbbbb;background:#f4f5f6;color:#3c3c3c;font-weight:700}
      .bs-shelf-count{font-size:11px;color:#7e7e7e;padding-right:5px}
      .bs-books-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .bs-book-card{background:#f7f7f7;border:1px solid var(--line);padding:17px 15px 14px;position:relative;min-width:0;transition:transform .18s,box-shadow .18s;cursor:pointer}
      .bs-book-card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
      .bs-book-card .bs-book-cover{width:87px;height:118px;margin:0 auto 17px;box-shadow:4px 5px 0 #d8dade,6px 7px 0 rgba(50, 50, 50, .04)}
      .bs-book-card .bs-cover-title{font-size:15px;max-height:79px}
      .bs-book-card .bs-cover-top{font-size:8px;margin-bottom:8px}
      .bs-book-card .bs-cover-author{font-size:7px;margin-top:7px}
      .bs-book-card h3{text-align:center;font-size:15px;margin:0 0 5px;line-height:1.5;min-height:23px}
      .bs-book-author{text-align:center;font-size:10px;color:#8e8e8e;margin-bottom:12px}
      .bs-empty-state{padding:50px;text-align:center;color:#858585;border:1px dashed var(--line-dark);grid-column:1/-1}
      .bs-empty-state strong{display:block;font-family:var(--serif);font-size:20px;color:#5f5f5f;margin:10px}
      .bs-review-actions .bs-btn{height:34px}
      .bs-file-book .bs-book-cover{width:54px;height:74px}
      .bs-file-book .bs-cover-title{font-size:10px}
      @media(max-width:1200px){.bs-content{padding:30px 28px 50px}.bs-books-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:900px){.bs-sidebar{width:206px;padding-left:12px;padding-right:12px}.bs-main{margin-left:206px}.bs-content{padding:25px 20px 45px}.bs-books-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:620px){.bs-sidebar{width:100%;height:auto;position:sticky;inset:0 0 auto;padding:10px 14px 9px;display:block;border-right:0;border-bottom:1px solid var(--line)}.bs-brand{padding:0 2px 8px;border:0}.bs-brand-title{font-size:17px}.bs-sidebar .bs-side-label,.bs-sidebar .bs-side-spacer,.bs-sidebar .bs-side-bottom{display:none}.bs-nav{display:flex;gap:4px;overflow:auto;padding-top:7px}.bs-nav button{flex:1;justify-content:center;gap:5px;padding:8px 7px;white-space:nowrap;font-size:11px}.bs-nav-count{display:none}.bs-main{margin-left:0}.bs-search{width:min(38vw,180px);height:32px}.bs-icon-button{width:32px;height:32px}.bs-content{padding:25px 14px 35px}.bs-page-head{align-items:flex-start;flex-direction:column;margin-bottom:22px;gap:15px}.bs-page-head h1{font-size:29px}.bs-page-head .bs-head-mark{display:none}.bs-lead{font-size:12px}.bs-record-row{grid-template-columns:48px minmax(0,1fr) auto;gap:10px;padding:14px 0}.bs-record-row .bs-book-cover{width:48px;height:65px}.bs-record-title{font-size:15px}.bs-record-excerpt{font-size:11px;line-height:1.7}.bs-books-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.bs-book-card{padding:12px 9px}.bs-book-card .bs-book-cover{width:78px;height:105px}.bs-book-card h3{font-size:13px}.bs-shelf-toolbar{align-items:flex-start}.bs-filter-group{width:100%}.bs-shelf-count{margin-left:auto}.bs-file-book .bs-book-cover{width:42px;height:60px}.bs-comment-form .bs-btn{flex:0 0 100%}}
      .bs-h1,.bs-h2,.bs-h3,.bs-serif{font-family:var(--serif)}
      .bs-h1{font-size:35px;letter-spacing:-.035em;line-height:1.32;font-weight:700;margin:0 0 12px}
      .bs-h3{font-size:17px;letter-spacing:-.025em;margin:0}
      .bs-page-head .bs-h1{margin-bottom:12px}
      @media(max-width:620px){.bs-h1{font-size:29px}}
      .bs-cover-img{object-fit:cover;box-shadow:2px 3px 0 rgba(49, 49, 49, .13);border-left:4px solid rgba(20, 20, 20, .14);flex-shrink:0;display:block;background:#e7e9ec}
      .bs-main{margin-left:244px;min-height:100vh}
      @media(max-width:900px){.bs-main{margin-left:206px}}
      @media(max-width:620px){.bs-main{margin-left:0}}
      .bs-quote-row{grid-template-columns:minmax(0,1fr)}
      .bs-quote-comment{font-size:12px;color:#6c6c6c;margin:-2px 0 6px 2px}
      .bs-prose .ProseMirror{outline:none;font-size:15px;line-height:1.85;color:var(--ink)}
      .bs-prose .ProseMirror>*:first-child{margin-top:0}
      .bs-prose .ProseMirror p{margin:0 0 .9em}
      .bs-prose .ProseMirror h2{font-size:21px;font-weight:700;margin:1.3em 0 .5em;letter-spacing:-.02em}
      .bs-prose .ProseMirror h3{font-size:17px;font-weight:700;margin:1.2em 0 .45em}
      .bs-prose .ProseMirror blockquote{margin:1em 0;padding:2px 0 2px 14px;border-left:3px solid var(--line-dark);color:#555a62}
      .bs-prose .ProseMirror ul{list-style:disc;padding-left:1.4em;margin:0 0 .9em}
      .bs-prose .ProseMirror ol{list-style:decimal;padding-left:1.5em;margin:0 0 .9em}
      .bs-prose .ProseMirror li p{margin:0 0 .3em}
      .bs-prose .ProseMirror strong{font-weight:700}
      .bs-prose .ProseMirror em{font-style:italic}
      .bs-editor-box .ProseMirror{padding:14px 16px;background:#f4f5f6;border:1px solid var(--line);border-radius:2px;min-height:260px}
      .bs-editor-box .ProseMirror:focus{border-color:var(--rust)}

      /* Y2K paper diary — simple grid paper, binder clips, restrained chrome details. */
      :root {
        --paper: #ffffff !important;
        --paper-light: #ffffff !important;
        --paper-deep: #f2f5f8 !important;
        --ink: #20252b !important;
        --ink-soft: #66717c !important;
        --ink-faint: #87919a !important;
        --line: #d6dce2 !important;
        --line-dark: #343b43 !important;
        --rust: #20252b !important;
        --rust-light: #e4f3ff !important;
        --olive: #66717c !important;
        --olive-light: #eef4f8 !important;
        --blue: #9bc9e8 !important;
        --blue-light: #edf7ff !important;
        --shadow: 3px 3px 0 rgba(195, 211, 224, .72) !important;
      }
      html {
        background: #fff !important;
        scroll-behavior: smooth;
      }
      body, body *, body *::before, body *::after {
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif !important;
        box-sizing: border-box;
      }
      body {
        margin: 0;
        color: #20252b !important;
        background-color: #fff !important;
        background-image:
          linear-gradient(rgba(110, 139, 162, .105) 1px, transparent 1px),
          linear-gradient(90deg, rgba(110, 139, 162, .105) 1px, transparent 1px) !important;
        background-size: 22px 22px !important;
        background-attachment: fixed !important;
        font-size: 14px;
        line-height: 1.65;
      }
      ::selection { background: #dff1ff !important; color: #20252b !important; }
      img, a:hover img, button:hover img, .bs-book-card:hover img { filter: none !important; }
      button { cursor: pointer; }

      /* Keep the shell paper-like and quiet. */
      .bs-main {
        min-height: 100vh !important;
        margin-left: 228px !important;
        color: #20252b !important;
        background: transparent !important;
      }
      .bs-sidebar {
        position: fixed !important;
        inset: 0 auto 0 0 !important;
        width: 228px !important;
        min-height: 100vh !important;
        padding: 22px 16px 18px !important;
        display: flex !important;
        flex-direction: column !important;
        background: rgba(255,255,255,.96) !important;
        border: 0 !important;
        border-right: 1px solid #cbd3db !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        z-index: 20 !important;
      }
      .bs-brand {
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;
        padding: 2px 4px 19px !important;
        border: 0 !important;
        border-bottom: 1px solid #dce2e8 !important;
      }
      .bs-brand::after {
        content: '';
        position: absolute;
        right: 12px;
        top: 1px;
        width: 9px;
        height: 23px;
        border: 1.5px solid #8b9aa7;
        border-bottom-color: transparent;
        border-radius: 8px 8px 3px 3px;
        transform: rotate(27deg);
        opacity: .9;
        pointer-events: none;
      }
      .bs-brand-title {
        color: #20252b !important;
        font-size: 22px !important;
        font-weight: 800 !important;
        letter-spacing: -.06em !important;
        line-height: 1.15 !important;
      }
      .bs-brand-sub, .bs-side-label, .bs-eyebrow, .bs-lead, .bs-stat-note,
      .bs-head-mark, .bs-book-card-top, .bs-book-ref, .bs-reader-label,
      .bs-footer-wrap, .bs-page-footer, .bs-archive-stamp, .bs-breadcrumb,
      .bs-topbar, .bs-stats-grid {
        display: none !important;
      }
      .bs-search-wrap { position: relative; }
      .bs-sidebar-search .bs-search, .bs-search {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 40px !important;
        height: 40px !important;
        padding: 0 12px !important;
        color: #20252b !important;
        background: #fff !important;
        border: 1px solid #cbd4dc !important;
        border-radius: 4px !important;
        box-shadow: inset 0 1px 2px rgba(38, 55, 68, .035) !important;
        font-size: 12px !important;
      }
      .bs-search::placeholder, input::placeholder, textarea::placeholder { color: #8a959f !important; opacity: 1; }
      .bs-nav { display: grid !important; gap: 4px !important; margin-top: 10px !important; padding: 0 !important; }
      .bs-nav button {
        width: 100% !important;
        min-height: 42px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        padding: 10px 12px !important;
        color: #48545f !important;
        text-align: left !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        background: transparent !important;
        border: 1px solid transparent !important;
        border-radius: 4px !important;
        box-shadow: none !important;
        transform: none !important;
        transition: background-color .16s ease, border-color .16s ease, color .16s ease !important;
      }
      .bs-nav button:hover {
        color: #20252b !important;
        background: #f5f9fc !important;
        border-color: #e0e8ee !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bs-nav button.bs-active {
        color: #20252b !important;
        background: #edf7ff !important;
        border-color: #b9d8ef !important;
        box-shadow: inset 3px 0 #79b9e3 !important;
        font-weight: 750 !important;
      }
      .bs-nav-count { margin-left: auto !important; color: #7f8b95 !important; font-size: 11px !important; }
      .bs-side-spacer { flex: 1 !important; min-height: 20px !important; }
      .bs-side-bottom { justify-content: flex-start !important; padding: 14px 4px 0 !important; color: #697783 !important; font-size: 11px !important; }
      .bs-sidebar::after {
        content: '+--------------+\\A| READ / WRITE |\\A+--------------+';
        white-space: pre;
        position: absolute;
        left: 21px;
        bottom: 58px;
        color: #a0b0bd;
        font-size: 9px;
        line-height: 1.55;
        letter-spacing: .035em;
        pointer-events: none;
      }
      .bs-mobile-menu-toggle { display: none !important; }

      /* Content heading and tiny Y2K log label. */
      .bs-content {
        position: relative !important;
        max-width: 1280px !important;
        margin: 0 auto !important;
        padding: 34px 36px 62px !important;
        background: transparent !important;
      }
      .bs-content::before {
        content: '[ MEMORY ARCHIVE // ONLINE ]';
        display: block;
        margin: 0 0 24px;
        padding: 0 0 10px;
        color: #8294a2;
        border-bottom: 1px dashed #cbd6df;
        font-size: 10px;
        font-weight: 650;
        letter-spacing: .13em;
      }
      .bs-page-head {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-end !important;
        gap: 18px !important;
        margin: 0 0 24px !important;
        padding: 0 !important;
        border: 0 !important;
      }
      .bs-heading-copy { max-width: none !important; }
      .bs-h1 {
        margin: 0 0 8px !important;
        color: #20252b !important;
        font-size: clamp(32px, 4vw, 48px) !important;
        line-height: 1.12 !important;
        font-weight: 800 !important;
        letter-spacing: -.065em !important;
        text-shadow: 1px 1px 0 #d9efff !important;
      }
      .bs-h3, .bs-section-title { color: #20252b !important; font-weight: 750 !important; letter-spacing: -.03em !important; }

      /* Paper sheets, pinned cards, clipped reading notes. */
      .bs-paper-panel, .bs-member-list, .bs-mini-calendar, .bs-stat-card,
      .bs-review-paper, .bs-file-card, .bs-comment, .bs-empty-state,
      .bs-shelf-toolbar, .bs-book-card, .bs-record-row, .bs-file-detail,
      .bs-editor-box .ProseMirror {
        background: rgba(255,255,255,.96) !important;
        border: 1px solid #d2dae1 !important;
        border-radius: 5px !important;
        box-shadow: 2px 3px 0 rgba(201,215,226,.68) !important;
      }
      .bs-books-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)) !important;
        gap: 18px !important;
        border: 0 !important;
      }
      .bs-book-card {
        position: relative !important;
        display: flex !important;
        flex-direction: column !important;
        min-width: 0 !important;
        padding: 18px 16px 15px !important;
        gap: 12px !important;
        border: 1px solid #cfd8df !important;
        border-radius: 5px !important;
        background: rgba(255,255,255,.97) !important;
        box-shadow: 3px 4px 0 #e0eaf1 !important;
        transition: border-color .16s ease, box-shadow .16s ease !important;
        transform: none !important;
        cursor: pointer;
      }
      .bs-book-card::before {
        content: '';
        position: absolute;
        z-index: 3;
        top: -9px;
        left: 20px;
        width: 10px;
        height: 25px;
        background: rgba(255,255,255,.92);
        border: 1.5px solid #91a3b1;
        border-bottom-color: #b9c5ce;
        border-radius: 7px 7px 4px 4px;
        transform: rotate(18deg);
        pointer-events: none;
      }
      .bs-book-card:hover {
        border-color: #aebfcb !important;
        box-shadow: 3px 4px 0 #d4e6f2 !important;
        transform: none !important;
      }
      .bs-book-card-main { display: grid !important; grid-template-columns: 82px minmax(0,1fr) !important; gap: 16px !important; align-items: stretch !important; min-width: 0 !important; }
      .bs-book-card-cover { width: 82px !important; min-width: 82px !important; display: flex !important; justify-content: center !important; }
      .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img {
        width: 82px !important; height: 112px !important; margin: 0 !important; object-fit: cover !important;
        filter: none !important; border-radius: 2px !important;
        border: 1px solid rgba(40,48,55,.12) !important;
        box-shadow: 2px 3px 0 rgba(190,204,216,.65) !important;
      }
      .bs-book-card-info { display: flex !important; flex-direction: column !important; align-items: stretch !important; min-width: 0 !important; min-height: 112px !important; padding: 0 !important; }
      .bs-book-card h3.bs-book-title, .bs-book-card h3.bs-book-title:hover {
        margin: 0 0 5px !important; color: #20252b !important; font-size: 16px !important;
        font-weight: 750 !important; line-height: 1.45 !important; letter-spacing: -.035em !important;
        text-align: left !important; overflow-wrap: anywhere;
      }
      .bs-book-card .bs-book-author { margin: 0 !important; color: #74808a !important; font-size: 11px !important; line-height: 1.55 !important; text-align: left !important; }
      .bs-book-card-readers {
        display: flex !important; justify-content: flex-end !important; align-items: center !important;
        flex-wrap: wrap !important; gap: 6px 9px !important; margin-top: auto !important;
        padding-top: 9px !important; min-width: 0 !important; border-top: 1px dashed #dce4ea !important;
      }
      .bs-book-reader { display: inline-flex !important; justify-content: flex-end !important; align-items: center !important; gap: 5px !important; min-width: 0 !important; color: #586873 !important; font-size: 11px !important; }
      .bs-reader-name { max-width: 105px !important; color: #687984 !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bs-book-card .bs-book-card-readers .bs-member-avatar { box-shadow: none !important; border: 1px solid #d0d0d0 !important; }
      .bs-shelf-toolbar { padding: 11px 12px !important; border-radius: 5px !important; background: rgba(255,255,255,.88) !important; }
      .bs-filter-group { gap: 5px !important; }
      .bs-filter-btn {
        min-height: 36px !important; padding: 7px 10px !important; color: #67747f !important;
        border: 1px solid transparent !important; border-radius: 4px !important; background: transparent !important;
        box-shadow: none !important; font-size: 11px !important; transform: none !important;
      }
      .bs-filter-btn:hover { color: #20252b !important; background: #f5f9fc !important; box-shadow: none !important; transform: none !important; }
      .bs-filter-btn.bs-active { color: #20252b !important; background: #edf7ff !important; border-color: #b9d8ef !important; box-shadow: none !important; font-weight: 750 !important; }
      .bs-shelf-count { color: #81909c !important; font-size: 11px !important; }
      .bs-empty-state { padding: 40px 24px !important; color: #74808a !important; }
      .bs-empty-state strong { color: #20252b !important; }

      /* Reviews and quotes stay readable; quote contents never collapse. */
      .bs-records { display: grid !important; gap: 12px !important; border: 0 !important; }
      .bs-record-row {
        position: relative !important;
        display: grid !important;
        grid-template-columns: 58px minmax(0,1fr) auto !important;
        align-items: center !important;
        gap: 15px !important;
        margin: 0 !important;
        padding: 17px 18px !important;
        border-radius: 5px !important;
        cursor: pointer;
        transition: border-color .16s ease, box-shadow .16s ease !important;
        transform: none !important;
      }
      .bs-record-row:hover, .bs-paper-panel:hover {
        border-color: #afc6d6 !important;
        box-shadow: 3px 4px 0 #e0eaf1 !important;
        transform: none !important;
      }
      .bs-record-title { color: #20252b !important; font-weight: 750 !important; }
      .bs-record-row:hover .bs-record-title { color: #20252b !important; }
      .bs-record-excerpt, .bs-review-body, .bs-comment-text { color: #303941 !important; }
      .bs-record-meta, .bs-book-author, .bs-comment-meta, .bs-file-book-author { color: #788590 !important; }
      .bs-quote-row { grid-template-columns: minmax(0,1fr) !important; }
      .bs-quote-full-text {
        display: block !important; max-height: none !important; height: auto !important; overflow: visible !important;
        white-space: pre-wrap !important; overflow-wrap: anywhere !important; word-break: break-word !important;
        line-clamp: unset !important; -webkit-line-clamp: unset !important;
        color: #303941 !important; font-size: 15px !important; line-height: 1.9 !important;
      }
      .bs-quote-comment { color: #788590 !important; }
      .bs-tag, .bs-tag.bs-green, .bs-tag.bs-blue { background: #edf7ff !important; border: 1px solid #d3e8f6 !important; color: #526575 !important; border-radius: 3px !important; box-shadow: none !important; }

      /* Inputs and buttons: simple outlined controls, no pillowy effects. */
      button, .bs-btn, .bs-filter-btn, .bs-icon-button, .bs-link-button, .bs-row-action,
      input, select, textarea, .bs-comment-input, .bs-search, .bs-editor-box .ProseMirror {
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif !important;
        border-radius: 4px !important;
      }
      button, .bs-btn, .bs-icon-button {
        min-height: 40px !important;
        border: 1px solid #aebbc5 !important;
        background: #fff !important;
        color: #20252b !important;
        box-shadow: 2px 2px 0 #e0eaf1 !important;
        transition: background-color .16s ease, border-color .16s ease !important;
        transform: none !important;
      }
      button:hover, .bs-btn:hover, .bs-icon-button:hover {
        background: #f4faff !important;
        border-color: #9fbfd5 !important;
        color: #20252b !important;
        box-shadow: 2px 2px 0 #d7e9f5 !important;
        transform: none !important;
      }
      button:active, .bs-btn:active, .bs-icon-button:active { transform: none !important; box-shadow: 1px 1px 0 #d7e9f5 !important; }
      .bs-btn-primary, .bs-btn-primary:hover, .bs-btn-primary:focus {
        background: #20252b !important; border-color: #20252b !important; color: #fff !important;
      }
      .bs-btn-primary:hover { box-shadow: 2px 2px 0 #9bc9e8 !important; }
      .bs-icon-button { min-width: 40px !important; min-height: 40px !important; }
      input, select, textarea, .bs-comment-input, .bs-editor-box .ProseMirror {
        min-height: 40px;
        color: #20252b !important;
        background: #fff !important;
        border: 1px solid #cbd4dc !important;
        box-shadow: inset 0 1px 2px rgba(38,55,68,.035) !important;
        padding: 10px 12px;
      }
      textarea { min-height: 120px; }
      input:focus, select:focus, textarea:focus, .bs-comment-input:focus, .bs-editor-box .ProseMirror:focus {
        outline: 2px solid #b9dff7 !important;
        outline-offset: 1px !important;
        border-color: #8dbedc !important;
        box-shadow: none !important;
      }
      :is(a, button, input, select, textarea, [tabindex]):focus-visible {
        outline: 2px solid #91cbed !important;
        outline-offset: 2px !important;
      }
      .bs-main [class*="bg-[#fafafa]"], .bs-main [class*="bg-[#f8f8f8]"],
      .bs-main [class*="bg-[#f7f7f7]"], .bs-main [class*="bg-[#f4f5f6]"], .bs-main [class*="bg-white"] { background-color: #fff !important; }
      .bs-main [class*="text-[#666b73]"], .bs-main [class*="text-[#555a62]"],
      .bs-main [class*="text-[#828282]"], .bs-main [class*="text-[#777b82]"] { color: #74808a !important; }
      .bs-main [class*="text-[#202328]"], .bs-main [class*="text-[#26292e]"], .bs-main [class*="text-[#34373d]"] { color: #20252b !important; }
      .bs-main [class*="rounded-"] { border-radius: 4px !important; }
      main.min-h-screen { background: transparent !important; }
      main.min-h-screen > .w-full.max-w-md {
        background: rgba(255,255,255,.97) !important; border: 1px solid #d2dae1 !important;
        border-radius: 5px !important; box-shadow: 3px 4px 0 #e0eaf1 !important;
      }
      main.min-h-screen > .w-full.max-w-md input { background: #fff !important; }
      .bs-main .fixed[role="dialog"] > div {
        background: #fff !important; border: 1px solid #d2dae1 !important;
        border-radius: 5px !important; box-shadow: 3px 4px 0 #e0eaf1 !important;
      }
      .bs-book-card:hover *, .bs-record-row:hover, .bs-paper-panel:hover,
      button:hover, a:hover { animation: none !important; }

      @media (max-width: 1200px) {
        .bs-content { padding: 30px 28px 54px !important; }
        .bs-books-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important; }
      }
      @media (max-width: 900px) {
        .bs-content { padding: 26px 22px 48px !important; }
        .bs-sidebar { width: 206px !important; }
        .bs-main { margin-left: 206px !important; }
      }
      @media (max-width: 620px) {
        .bs-sidebar {
          width: 100% !important; min-height: 0 !important; height: auto !important;
          position: sticky !important; inset: 0 0 auto !important; padding: 12px 14px !important;
          display: block !important; border: 0 !important; border-bottom: 1px solid #cbd3db !important;
          background: rgba(255,255,255,.97) !important; box-shadow: none !important; z-index: 20 !important;
        }
        .bs-sidebar::after { display: none !important; }
        .bs-brand { padding: 0 2px !important; border: 0 !important; }
        .bs-brand::after { right: 64px !important; top: 1px !important; }
        .bs-brand-title { font-size: 19px !important; }
        .bs-mobile-menu-toggle {
          display: inline-flex !important; align-items: center !important; justify-content: center !important;
          min-width: 44px !important; min-height: 40px !important; padding: 0 12px !important;
          background: #fff !important; border: 1px solid #cbd4dc !important; border-radius: 4px !important;
          box-shadow: 2px 2px 0 #e0eaf1 !important; color: #20252b !important; font-size: 12px !important;
        }
        .bs-sidebar-search, .bs-nav, .bs-side-bottom { display: none !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-sidebar-search { display: block !important; padding: 14px 2px 8px !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-nav { display: flex !important; flex-direction: column !important; padding-top: 8px !important; margin-top: 5px !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-side-bottom { display: flex !important; padding: 8px 8px 0 !important; }
        .bs-nav button { width: 100% !important; justify-content: flex-start !important; }
        .bs-main { margin-left: 0 !important; }
        .bs-content { padding: 22px 14px 34px !important; }
        .bs-content::before { margin-bottom: 18px !important; font-size: 9px !important; }
        .bs-page-head { align-items: flex-start !important; flex-direction: column !important; margin-bottom: 18px !important; gap: 12px !important; }
        .bs-h1 { font-size: clamp(32px, 9vw, 42px) !important; }
        .bs-books-grid { grid-template-columns: minmax(0,1fr) !important; gap: 15px !important; }
        .bs-book-card { padding: 16px !important; }
        .bs-book-card-main { grid-template-columns: 78px minmax(0,1fr) !important; gap: 13px !important; }
        .bs-book-card-cover { width: 78px !important; min-width: 78px !important; }
        .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img { width: 78px !important; height: 106px !important; }
        .bs-book-card-info { min-height: 106px !important; }
        .bs-book-card-readers { gap: 5px !important; }
        .bs-reader-name { max-width: 90px !important; }
        .bs-record-row { grid-template-columns: 48px minmax(0,1fr) !important; gap: 11px !important; padding: 15px !important; }
        .bs-record-row .bs-book-cover { width: 48px !important; height: 65px !important; }
        .bs-comment-form .bs-btn { flex: 1 1 100%; }
      }


      /* Reference UI: quiet monochrome reading community, kept in Pretendard. */
      :root {
        --paper: #f7f7f7 !important;
        --paper-light: #ffffff !important;
        --paper-deep: #eeeeee !important;
        --ink: #111111 !important;
        --ink-soft: #666666 !important;
        --ink-faint: #888888 !important;
        --line: #d2d2d2 !important;
        --line-dark: #a9a9a9 !important;
        --rust: #222222 !important;
        --rust-light: #e7e7e7 !important;
        --olive: #555555 !important;
        --olive-light: #eeeeee !important;
        --blue: #777777 !important;
        --blue-light: #eeeeee !important;
        --shadow: none !important;
      }
      html, body {
        background-color: #f7f7f7 !important;
        color: #111111 !important;
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif !important;
      }
      body {
        background-image:
          linear-gradient(rgba(17,17,17,.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(17,17,17,.022) 1px, transparent 1px) !important;
        background-size: 24px 24px !important;
        line-height: 1.6 !important;
      }
      body, body *, body *::before, body *::after {
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif !important;
        box-sizing: border-box;
      }
      ::selection { background: #dedede !important; color: #111111 !important; }
      .bs-main {
        width: calc(100% - 248px) !important;
        min-height: 100vh !important;
        margin-left: 248px !important;
        color: #111111 !important;
        background: transparent !important;
      }
      .bs-sidebar {
        position: fixed !important;
        inset: 0 auto 0 0 !important;
        width: 248px !important;
        min-height: 100vh !important;
        padding: 30px 24px 24px !important;
        display: flex !important;
        flex-direction: column !important;
        background: #f0f0f0 !important;
        border: 0 !important;
        border-right: 1px solid #d2d2d2 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        z-index: 20 !important;
      }
      .bs-brand {
        padding: 0 8px 22px !important;
        border: 0 !important;
        border-bottom: 1px solid #d2d2d2 !important;
      }
      .bs-brand::after { display: none !important; }
      .bs-brand-title {
        color: #111111 !important;
        font-size: 26px !important;
        line-height: 1.2 !important;
        font-weight: 800 !important;
        letter-spacing: -.055em !important;
        text-shadow: none !important;
      }
      .bs-sidebar-search .bs-search, .bs-search {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 42px !important;
        height: 42px !important;
        padding: 0 12px !important;
        color: #111111 !important;
        background: #ffffff !important;
        border: 1px solid #c8c8c8 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        font-size: 12px !important;
      }
      .bs-search::placeholder, input::placeholder, textarea::placeholder { color: #888888 !important; opacity: 1; }
      .bs-nav {
        display: grid !important;
        gap: 4px !important;
        margin-top: 15px !important;
        padding: 0 !important;
      }
      .bs-nav button {
        width: 100% !important;
        min-height: 42px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        padding: 10px 12px !important;
        color: #555555 !important;
        text-align: left !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        background: transparent !important;
        border: 1px solid transparent !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        transform: none !important;
        transition: background-color .15s ease, color .15s ease !important;
      }
      .bs-nav button:hover {
        color: #111111 !important;
        background: #e6e6e6 !important;
        border-color: transparent !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bs-nav button.bs-active {
        color: #111111 !important;
        background: #dedede !important;
        border-color: #dedede !important;
        box-shadow: inset 3px 0 #222222 !important;
        font-weight: 750 !important;
      }
      .bs-nav-count { margin-left: auto !important; color: #777777 !important; font-size: 11px !important; }
      .bs-side-spacer { flex: 1 !important; min-height: 24px !important; }
      .bs-side-bottom { justify-content: flex-start !important; padding: 12px 8px 0 !important; color: #666666 !important; font-size: 11px !important; }
      .bs-sidebar::after {
        content: '+----------------+\\A| READ / WRITE   |\\A+----------------+' !important;
        white-space: pre !important;
        position: absolute !important;
        left: 32px !important;
        bottom: 72px !important;
        color: #999999 !important;
        font-size: 9px !important;
        line-height: 1.6 !important;
        letter-spacing: .02em !important;
        pointer-events: none !important;
      }
      .bs-mobile-menu-toggle { display: none !important; }
      .bs-content {
        position: relative !important;
        width: 100% !important;
        max-width: 1160px !important;
        margin: 0 auto !important;
        padding: 56px clamp(30px, 5.2vw, 76px) 80px !important;
        background: transparent !important;
      }
      .bs-content::before {
        content: none !important;
        display: none !important;
      }
      .bs-page-head {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-end !important;
        gap: 22px !important;
        margin: 0 0 28px !important;
        padding: 0 0 22px !important;
        border: 0 !important;
        border-bottom: 1px solid #d0d0d0 !important;
      }
      .bs-heading-copy { max-width: none !important; }
      .bs-h1 {
        margin: 0 0 8px !important;
        color: #111111 !important;
        font-size: clamp(34px, 4.2vw, 46px) !important;
        line-height: 1.15 !important;
        font-weight: 800 !important;
        letter-spacing: -.055em !important;
        text-shadow: none !important;
      }
      .bs-h3, .bs-section-title { color: #111111 !important; font-weight: 750 !important; letter-spacing: -.03em !important; }
      .bs-eyebrow, .bs-lead, .bs-stat-note, .bs-head-mark, .bs-book-card-top,
      .bs-book-ref, .bs-reader-label, .bs-footer-wrap, .bs-page-footer,
      .bs-archive-stamp, .bs-breadcrumb, .bs-topbar, .bs-stats-grid {
        display: none !important;
      }
      .bs-paper-panel, .bs-member-list, .bs-mini-calendar, .bs-stat-card,
      .bs-review-paper, .bs-file-card, .bs-comment, .bs-empty-state,
      .bs-shelf-toolbar, .bs-book-card, .bs-record-row, .bs-file-detail,
      .bs-editor-box .ProseMirror {
        background: #ffffff !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .bs-books-grid {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 0 !important;
        border: 0 !important;
        border-top: 1px solid #cfcfcf !important;
      }
      .bs-book-card {
        position: relative !important;
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 22px 0 !important;
        border: 0 !important;
        border-bottom: 1px solid #cfcfcf !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        transform: none !important;
        cursor: pointer !important;
        transition: background-color .15s ease !important;
      }
      .bs-book-card::before {
        content: '' !important;
        position: absolute !important;
        z-index: 3 !important;
        top: 28px !important;
        left: 3px !important;
        width: 9px !important;
        height: 23px !important;
        background: rgba(255,255,255,.9) !important;
        border: 1px solid #8f969b !important;
        border-bottom-color: #c0c4c7 !important;
        border-radius: 7px 7px 4px 4px !important;
        transform: rotate(17deg) !important;
        pointer-events: none !important;
      }
      .bs-book-card:hover {
        background: rgba(255,255,255,.55) !important;
        border-color: #cfcfcf !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bs-book-card-main {
        display: grid !important;
        grid-template-columns: 88px minmax(0,1fr) !important;
        gap: 22px !important;
        align-items: stretch !important;
        min-width: 0 !important;
      }
      .bs-book-card-cover {
        position: relative !important;
        width: 88px !important;
        min-width: 88px !important;
        display: flex !important;
        justify-content: center !important;
      }
      .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img {
        display: block !important;
        width: 88px !important;
        height: 132px !important;
        margin: 0 !important;
        object-fit: cover !important;
        filter: none !important;
        border-radius: 0 !important;
        border: 1px solid rgba(17,17,17,.12) !important;
        box-shadow: none !important;
        background-color: #dedede;
      }
      img, a:hover img, button:hover img, .bs-book-card:hover img { filter: none !important; }
      .bs-book-card-info {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        min-width: 0 !important;
        min-height: 132px !important;
        padding: 0 !important;
      }
      .bs-book-card h3.bs-book-title, .bs-book-card h3.bs-book-title:hover {
        margin: 0 0 5px !important;
        color: #111111 !important;
        font-size: 18px !important;
        font-weight: 750 !important;
        line-height: 1.4 !important;
        letter-spacing: -.035em !important;
        text-align: left !important;
        overflow-wrap: anywhere !important;
      }
      .bs-book-card .bs-book-author {
        margin: 0 !important;
        color: #777777 !important;
        font-size: 11px !important;
        line-height: 1.55 !important;
        text-align: left !important;
      }
      .bs-book-card-quote {
        margin: 17px 0 12px !important;
        display: -webkit-box !important;
        overflow: hidden !important;
        -webkit-box-orient: vertical !important;
        -webkit-line-clamp: 2 !important;
        color: #333333 !important;
        font-size: 12px !important;
        line-height: 1.8 !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
      }
      .bs-book-card-readers {
        display: flex !important;
        justify-content: flex-end !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        gap: 6px 9px !important;
        margin-top: auto !important;
        padding-top: 10px !important;
        min-width: 0 !important;
        border-top: 0 !important;
      }
      .bs-book-reader {
        display: inline-flex !important;
        justify-content: flex-end !important;
        align-items: center !important;
        gap: 5px !important;
        min-width: 0 !important;
        color: #555555 !important;
        font-size: 11px !important;
      }
      .bs-reader-name { max-width: 110px !important; color: #666666 !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bs-book-card .bs-book-card-readers .bs-member-avatar { box-shadow: none !important; border: 1px solid #d0d0d0 !important; }
      .bs-shelf-toolbar {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 16px !important;
        margin: 26px 0 18px !important;
        padding: 10px 0 !important;
        border: 0 !important;
        border-bottom: 1px solid #d0d0d0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      .bs-filter-group { gap: 5px !important; }
      .bs-filter-btn {
        min-height: 36px !important;
        padding: 7px 10px !important;
        color: #666666 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        font-size: 11px !important;
        transform: none !important;
      }
      .bs-filter-btn:hover { color: #111111 !important; background: #e9e9e9 !important; box-shadow: none !important; transform: none !important; }
      .bs-filter-btn.bs-active { color: #111111 !important; background: #e5e5e5 !important; border: 0 !important; box-shadow: inset 0 -2px #111111 !important; font-weight: 750 !important; }
      .bs-shelf-count { display: none !important; }
      .bs-empty-state {
        padding: 40px 8px !important;
        color: #666666 !important;
        border-top: 0 !important;
        border-bottom: 1px solid #d0d0d0 !important;
        text-align: left !important;
      }
      .bs-empty-state strong { color: #111111 !important; }
      .bs-records { display: grid !important; gap: 0 !important; border: 0 !important; border-top: 1px solid #cfcfcf !important; }
      .bs-record-row {
        position: relative !important;
        display: grid !important;
        grid-template-columns: 58px minmax(0,1fr) auto !important;
        align-items: center !important;
        gap: 18px !important;
        margin: 0 !important;
        padding: 20px 0 !important;
        border: 0 !important;
        border-bottom: 1px solid #cfcfcf !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        cursor: pointer !important;
        transition: background-color .15s ease !important;
        transform: none !important;
      }
      .bs-record-row:hover, .bs-paper-panel:hover {
        background: rgba(255,255,255,.55) !important;
        border-color: #cfcfcf !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bs-record-title { color: #111111 !important; font-size: 17px !important; font-weight: 750 !important; }
      .bs-record-row:hover .bs-record-title { color: #111111 !important; }
      .bs-record-excerpt, .bs-review-body, .bs-comment-text { color: #333333 !important; }
      .bs-record-meta, .bs-book-author, .bs-comment-meta, .bs-file-book-author { color: #777777 !important; }
      .bs-quote-row { grid-template-columns: minmax(0,1fr) !important; padding: 22px 0 !important; }
      .bs-quote-full-text {
        display: block !important; max-height: none !important; height: auto !important; overflow: visible !important;
        white-space: pre-wrap !important; overflow-wrap: anywhere !important; word-break: break-word !important;
        line-clamp: unset !important; -webkit-line-clamp: unset !important;
        color: #222222 !important; font-size: 15px !important; line-height: 1.85 !important;
      }
      .bs-quote-comment { margin: 6px 0 4px !important; color: #666666 !important; }
      .bs-tag, .bs-tag.bs-green, .bs-tag.bs-blue {
        background: #eeeeee !important; border: 1px solid #d8d8d8 !important;
        color: #555555 !important; border-radius: 0 !important; box-shadow: none !important;
      }
      button, .bs-btn, .bs-filter-btn, .bs-icon-button, .bs-link-button, .bs-row-action,
      input, select, textarea, .bs-comment-input, .bs-editor-box .ProseMirror {
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif !important;
        border-radius: 0 !important;
      }
      button, .bs-btn, .bs-icon-button {
        min-height: 40px !important;
        border: 1px solid #bfbfbf !important;
        background: #ffffff !important;
        color: #111111 !important;
        box-shadow: none !important;
        transition: background-color .15s ease, color .15s ease, border-color .15s ease !important;
        transform: none !important;
      }
      button:hover, .bs-btn:hover, .bs-icon-button:hover {
        background: #e9e9e9 !important;
        border-color: #999999 !important;
        color: #111111 !important;
        box-shadow: none !important;
        transform: none !important;
      }
      button:active, .bs-btn:active, .bs-icon-button:active { transform: none !important; box-shadow: none !important; }
      .bs-btn-primary, .bs-btn-primary:hover, .bs-btn-primary:focus {
        background: #111111 !important; border-color: #111111 !important; color: #ffffff !important;
      }
      .bs-btn-primary:hover { background: #333333 !important; }
      .bs-icon-button { min-width: 40px !important; min-height: 40px !important; }
      input, select, textarea, .bs-comment-input, .bs-editor-box .ProseMirror {
        min-height: 40px;
        color: #111111 !important;
        background: #ffffff !important;
        border: 1px solid #c9c9c9 !important;
        box-shadow: none !important;
        padding: 10px 12px;
      }
      textarea { min-height: 120px; }
      input:focus, select:focus, textarea:focus, .bs-comment-input:focus, .bs-editor-box .ProseMirror:focus {
        outline: 2px solid #666666 !important;
        outline-offset: 2px !important;
        border-color: #666666 !important;
        box-shadow: none !important;
      }
      :is(a, button, input, select, textarea, [tabindex]):focus-visible {
        outline: 2px solid #555555 !important;
        outline-offset: 2px !important;
      }
      .bs-main [class*="bg-[#fafafa]"], .bs-main [class*="bg-[#f8f8f8]"],
      .bs-main [class*="bg-[#f7f7f7]"], .bs-main [class*="bg-[#f4f5f6]"],
      .bs-main [class*="bg-white"] { background-color: #ffffff !important; }
      .bs-main [class*="text-[#666b73]"], .bs-main [class*="text-[#555a62]"],
      .bs-main [class*="text-[#828282]"], .bs-main [class*="text-[#777b82]"] { color: #666666 !important; }
      .bs-main [class*="text-[#202328]"], .bs-main [class*="text-[#26292e]"],
      .bs-main [class*="text-[#34373d]"] { color: #222222 !important; }
      .bs-main [class*="rounded-"] { border-radius: 0 !important; }
      main.min-h-screen { background: transparent !important; }
      main.min-h-screen > .w-full.max-w-md {
        background: #ffffff !important; border: 1px solid #d0d0d0 !important;
        border-radius: 0 !important; box-shadow: none !important;
      }
      main.min-h-screen > .w-full.max-w-md input { background: #ffffff !important; }
      .bs-main .fixed[role="dialog"] > div {
        background: #ffffff !important; border: 1px solid #d0d0d0 !important;
        border-radius: 0 !important; box-shadow: none !important;
      }
      .bs-book-card:hover *, .bs-record-row:hover, .bs-paper-panel:hover,
      button:hover, a:hover { animation: none !important; }

      @media (max-width: 1200px) {
        .bs-content { padding: 42px 34px 64px !important; }
        .bs-main { width: calc(100% - 248px) !important; }
      }
      @media (max-width: 900px) {
        .bs-content { padding: 34px 26px 54px !important; }
        .bs-sidebar { width: 210px !important; padding: 26px 18px 20px !important; }
        .bs-main { width: calc(100% - 210px) !important; margin-left: 210px !important; }
      }
      @media (max-width: 620px) {
        .bs-sidebar {
          width: 100% !important; min-height: 0 !important; height: auto !important;
          position: sticky !important; inset: 0 0 auto !important; padding: 12px 14px !important;
          display: block !important; border: 0 !important; border-bottom: 1px solid #d0d0d0 !important;
          background: rgba(247,247,247,.98) !important; box-shadow: none !important; z-index: 20 !important;
        }
        .bs-sidebar::after { display: none !important; }
        .bs-brand { padding: 0 2px !important; border: 0 !important; }
        .bs-brand-title { font-size: 21px !important; }
        .bs-mobile-menu-toggle {
          display: inline-flex !important; align-items: center !important; justify-content: center !important;
          min-width: 44px !important; min-height: 40px !important; padding: 0 12px !important;
          background: #ffffff !important; border: 1px solid #c9c9c9 !important; border-radius: 0 !important;
          box-shadow: none !important; color: #111111 !important; font-size: 12px !important;
        }
        .bs-sidebar-search, .bs-nav, .bs-side-bottom { display: none !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-sidebar-search { display: block !important; padding: 14px 2px 8px !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-nav { display: flex !important; flex-direction: column !important; padding-top: 8px !important; margin-top: 5px !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-side-bottom { display: flex !important; padding: 8px 8px 0 !important; }
        .bs-nav button { width: 100% !important; justify-content: flex-start !important; }
        .bs-main { width: 100% !important; margin-left: 0 !important; }
        .bs-content { padding: 30px 18px 42px !important; }
        .bs-page-head { align-items: flex-start !important; flex-direction: column !important; margin-bottom: 18px !important; padding-bottom: 16px !important; gap: 12px !important; }
        .bs-h1 { font-size: clamp(31px, 8vw, 40px) !important; }
        .bs-books-grid { grid-template-columns: minmax(0,1fr) !important; gap: 0 !important; }
        .bs-book-card { padding: 18px 0 !important; }
        .bs-book-card-main { grid-template-columns: 76px minmax(0,1fr) !important; gap: 15px !important; }
        .bs-book-card-cover { width: 76px !important; min-width: 76px !important; }
        .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img { width: 76px !important; height: 114px !important; }
        .bs-book-card-info { min-height: 114px !important; }
        .bs-book-card-quote { margin-top: 12px !important; font-size: 11px !important; }
        .bs-book-card-readers { gap: 5px !important; }
        .bs-reader-name { max-width: 90px !important; }
        .bs-record-row { grid-template-columns: 48px minmax(0,1fr) !important; gap: 12px !important; padding: 16px 0 !important; }
        .bs-record-row .bs-book-cover { width: 48px !important; height: 65px !important; }
        .bs-comment-form .bs-btn { flex: 1 1 100%; }
        .bs-sidebar::after { display: none !important; }
      }
      /* Final reference layout: plain monochrome library, no grid or decorative clips. */
      html, body {
        background: #f7f7f7 !important;
        background-image: none !important;
        color: #111111 !important;
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif !important;
      }
      body, body *, body *::before, body *::after {
        font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif !important;
        box-sizing: border-box;
      }
      body { line-height: 1.6 !important; }
      img, img:hover, button:hover img, a:hover img { filter: none !important; }
      .bs-main {
        width: calc(100% - 225px) !important;
        margin-left: 225px !important;
        min-height: 100vh !important;
        background: #f7f7f7 !important;
        color: #111111 !important;
      }
      .bs-sidebar {
        position: fixed !important;
        inset: 0 auto 0 0 !important;
        width: 225px !important;
        min-height: 100vh !important;
        display: flex !important;
        flex-direction: column !important;
        padding: 25px 22px 24px !important;
        background: #f1f1f1 !important;
        border: 0 !important;
        border-right: 1px solid #dddddd !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        z-index: 30 !important;
      }
      .bs-sidebar::before, .bs-sidebar::after, .bs-brand::before, .bs-brand::after {
        content: none !important;
        display: none !important;
      }
      .bs-brand {
        padding: 0 7px 18px !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      .bs-brand-title {
        color: #111111 !important;
        font-size: 38px !important;
        line-height: .94 !important;
        font-weight: 850 !important;
        letter-spacing: -.075em !important;
      }
      .bs-brand-sub, .bs-side-label, .bs-eyebrow, .bs-lead, .bs-head-mark,
      .bs-breadcrumb, .bs-topbar, .bs-sidebar-search, .bs-nav-ico,
      .bs-footer-wrap, .bs-page-footer, .bs-archive-stamp, .bs-stats-grid {
        display: none !important;
      }
      .bs-nav {
        display: grid !important;
        gap: 2px !important;
        margin: 10px 0 0 !important;
        padding: 0 !important;
        border: 0 !important;
      }
      .bs-nav button {
        min-height: 33px !important;
        width: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        padding: 6px 10px !important;
        color: #555555 !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        transform: none !important;
        text-align: left !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        transition: background-color .12s ease, color .12s ease !important;
        outline: none !important;
      }
      .bs-nav button:hover {
        background: #e8e8e8 !important;
        color: #111111 !important;
        border: 0 !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bs-nav button.bs-active {
        background: #dddddd !important;
        color: #111111 !important;
        border: 0 !important;
        border-left: 0 !important;
        box-shadow: none !important;
        font-weight: 750 !important;
      }
      .bs-nav button:focus, .bs-nav button:focus-visible {
        outline: 1px solid #999999 !important;
        outline-offset: -1px !important;
        box-shadow: none !important;
      }
      .bs-nav-count {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 18px !important;
        height: 18px !important;
        margin-left: auto !important;
        padding: 0 4px !important;
        background: #111111 !important;
        color: #ffffff !important;
        font-family: 'Pretendard', sans-serif !important;
        font-size: 10px !important;
        font-weight: 700 !important;
      }
      .bs-side-spacer { flex: 1 !important; min-height: 24px !important; }
      .bs-side-bottom {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 0 !important;
        padding: 13px 2px 0 !important;
        border-top: 1px solid #d0d0d0 !important;
        color: #333333 !important;
      }
      .bs-profile-settings {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        min-height: 42px !important;
        display: flex !important;
        align-items: center !important;
        gap: 9px !important;
        padding: 0 !important;
        color: #111111 !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        text-align: left !important;
      }
      .bs-profile-settings > span:first-child {
        width: 32px !important;
        height: 32px !important;
        flex: 0 0 32px !important;
        transform: none !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: #d8d8d8 !important;
        color: #111111 !important;
      }
      .bs-profile-name {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        overflow: hidden !important;
        color: #111111 !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .bs-settings-icon { flex: 0 0 auto !important; color: #666666 !important; }
      .bs-logout-icon {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 28px !important;
        height: 32px !important;
        padding: 0 !important;
        color: #777777 !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .bs-logout-icon:hover, .bs-profile-settings:hover {
        background: #e8e8e8 !important;
        color: #111111 !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bs-main-search {
        position: relative !important;
        display: block !important;
        width: 100% !important;
        margin: 42px 0 18px !important;
      }
      .bs-main-search .bs-search-icon {
        position: absolute !important;
        left: 13px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        color: #777777 !important;
        font-size: 20px !important;
        line-height: 1 !important;
        pointer-events: none !important;
      }
      .bs-main-search .bs-search {
        width: 100% !important;
        height: 38px !important;
        min-height: 38px !important;
        padding: 0 40px 0 38px !important;
        background: #ffffff !important;
        color: #111111 !important;
        border: 1px solid #cecece !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        font-size: 11px !important;
      }
      .bs-main-search .bs-search:focus {
        outline: 1px solid #888888 !important;
        outline-offset: 0 !important;
        border-color: #999999 !important;
        box-shadow: none !important;
      }
      .bs-search-clear {
        position: absolute !important;
        right: 6px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 27px !important;
        height: 27px !important;
        padding: 0 !important;
        background: transparent !important;
        color: #555555 !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        font-size: 17px !important;
      }
      .bs-content {
        width: 100% !important;
        max-width: 1050px !important;
        margin: 0 !important;
        padding: 56px 70px 60px 80px !important;
        color: #111111 !important;
        background: transparent !important;
      }
      .bs-page-head {
        display: flex !important;
        align-items: flex-end !important;
        justify-content: space-between !important;
        gap: 20px !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
      }
      .bs-h1, .bs-page-head .bs-h1 {
        margin: 0 !important;
        color: #111111 !important;
        font-size: 34px !important;
        line-height: 1.2 !important;
        font-weight: 800 !important;
        letter-spacing: -.055em !important;
      }
      .bs-btn, .bs-btn-primary, .bs-btn-small {
        min-height: 38px !important;
        height: 38px !important;
        padding: 0 15px !important;
        border: 1px solid #111111 !important;
        border-radius: 0 !important;
        background: #111111 !important;
        color: #ffffff !important;
        box-shadow: none !important;
        transform: none !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        transition: background-color .12s ease, color .12s ease !important;
      }
      .bs-btn:hover, .bs-btn-primary:hover, .bs-btn-small:hover {
        background: #ffffff !important;
        color: #111111 !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bs-record-cta { display: inline-flex !important; gap: 7px !important; white-space: nowrap !important; }
      .bs-record-cta > span:first-child { font-size: 18px !important; line-height: 1 !important; font-weight: 400 !important; }
      .bs-icon-button, .bs-add-scrap {
        width: 38px !important;
        min-width: 38px !important;
        height: 38px !important;
        min-height: 38px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        background: #111111 !important;
        color: #ffffff !important;
        border: 1px solid #111111 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        font-size: 20px !important;
      }
      .bs-icon-button:hover, .bs-add-scrap:hover { background: #ffffff !important; color: #111111 !important; box-shadow: none !important; transform: none !important; }
      .bs-shelf-toolbar { display: none !important; }
      .bs-books-grid {
        display: flex !important;
        flex-direction: column !important;
        grid-template-columns: none !important;
        gap: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border-top: 1px solid #d0d0d0 !important;
      }
      .bs-book-card {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        padding: 16px 0 !important;
        background: transparent !important;
        border: 0 !important;
        border-bottom: 1px solid #d0d0d0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        transform: none !important;
        cursor: pointer;
        transition: none !important;
      }
      .bs-book-card:hover, .bs-book-card:focus, .bs-book-card:focus-within {
        background: transparent !important;
        border-color: #d0d0d0 !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bs-book-card-main {
        display: grid !important;
        grid-template-columns: 80px minmax(0, 1fr) !important;
        align-items: start !important;
        gap: 20px !important;
        min-width: 0 !important;
      }
      .bs-book-card-cover { width: 80px !important; min-width: 80px !important; display: block !important; }
      .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img {
        display: block !important;
        width: 80px !important;
        height: 120px !important;
        min-width: 80px !important;
        max-width: none !important;
        object-fit: cover !important;
        filter: none !important;
        border: 1px solid #222222 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .bs-book-card-info {
        position: relative !important;
        min-width: 0 !important;
        min-height: 120px !important;
        padding: 1px 0 0 !important;
      }
      .bs-book-card h3, .bs-book-card .bs-book-title {
        margin: 0 0 3px !important;
        padding-right: 78px !important;
        color: #111111 !important;
        font-size: 15px !important;
        line-height: 1.4 !important;
        font-weight: 750 !important;
        text-align: left !important;
        min-height: 0 !important;
        letter-spacing: -.025em !important;
      }
      .bs-book-author {
        margin: 0 0 5px !important;
        color: #666666 !important;
        text-align: left !important;
        font-size: 11px !important;
      }
      .bs-book-rating {
        display: flex !important;
        align-items: center !important;
        gap: 7px !important;
        margin: 2px 0 7px !important;
        color: #555555 !important;
        font-size: 10px !important;
        line-height: 1.3 !important;
      }
      .bs-rating-stars { display: inline-flex !important; gap: 1px !important; color: #222222 !important; font-size: 13px !important; letter-spacing: -.04em !important; }
      .bs-rating-meta { color: #666666 !important; font-size: 10px !important; }
      .bs-book-card-quote {
        margin: 8px 0 0 !important;
        max-width: 100% !important;
        color: #222222 !important;
        font-size: 11px !important;
        line-height: 1.75 !important;
      }
      .bs-book-card-readers {
        position: absolute !important;
        top: 0 !important;
        right: 0 !important;
        display: flex !important;
        align-items: flex-start !important;
        justify-content: flex-end !important;
        gap: 2px !important;
        max-width: 75px !important;
        margin: 0 !important;
      }
      .bs-book-reader { display: inline-flex !important; min-width: 0 !important; margin: 0 !important; }
      .bs-book-reader > span:first-child { display: none !important; }
      .bs-reader-name {
        display: inline-block !important;
        max-width: 24px !important;
        overflow: hidden !important;
        padding: 3px 5px !important;
        background: #dedede !important;
        color: #222222 !important;
        font-size: 9px !important;
        line-height: 1.2 !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .bs-records { border-top: 1px solid #d0d0d0 !important; }
      .bs-record-row { padding: 16px 0 !important; border-bottom: 1px solid #d0d0d0 !important; }
      .bs-record-excerpt, .bs-quote-full-text { font-size: 12px !important; color: #222222 !important; line-height: 1.8 !important; }
      .bs-record-meta { margin-top: 7px !important; color: #666666 !important; font-size: 10px !important; }
      .bs-empty-state { border: 0 !important; border-top: 1px solid #d0d0d0 !important; color: #666666 !important; }
      .bs-paper-panel, .bs-review-paper, .bs-file-card, .bs-member-list, .bs-mini-calendar,
      .bs-stat-card, .bs-book-card, .bs-editor-box .ProseMirror, input, textarea, select,
      .bs-bookmark-mini, .bs-row-action {
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .bs-main .rounded, .bs-main .rounded-sm, .bs-main .rounded-md, .bs-main .rounded-lg,
      .bs-main .rounded-xl, .bs-main .rounded-2xl, .bs-main .rounded-3xl, .bs-main .rounded-full {
        border-radius: 0 !important;
      }
      .bs-main input, .bs-main textarea, .bs-main select {
        color: #111111 !important;
        background: #ffffff !important;
        border-color: #cecece !important;
        box-shadow: none !important;
      }
      .bs-main button:focus-visible, .bs-sidebar button:focus-visible {
        outline: 1px solid #555555 !important;
        outline-offset: 2px !important;
        box-shadow: none !important;
      }
      @media (max-width: 900px) {
        .bs-main { width: calc(100% - 206px) !important; margin-left: 206px !important; }
        .bs-sidebar { width: 206px !important; padding: 24px 14px 18px !important; }
        .bs-content { padding: 38px 28px 48px !important; }
      }
      @media (max-width: 620px) {
        .bs-sidebar {
          position: sticky !important;
          inset: 0 auto auto 0 !important;
          width: 100% !important;
          min-height: auto !important;
          height: auto !important;
          padding: 10px 14px 9px !important;
          display: block !important;
          border-right: 0 !important;
          border-bottom: 1px solid #dddddd !important;
          background: #f1f1f1 !important;
        }
        .bs-brand { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 2px !important; }
        .bs-brand-title { font-size: 24px !important; line-height: .95 !important; }
        .bs-mobile-menu-toggle {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 42px !important;
          height: 42px !important;
          min-width: 42px !important;
          padding: 0 !important;
          color: #111111 !important;
          background: transparent !important;
          border: 1px solid #cecece !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .bs-sidebar .bs-nav, .bs-sidebar .bs-side-spacer, .bs-sidebar .bs-side-bottom { display: none !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-nav { display: flex !important; flex-direction: column !important; gap: 2px !important; margin-top: 10px !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-side-bottom { display: flex !important; margin-top: 14px !important; }
        .bs-main { width: 100% !important; margin-left: 0 !important; }
        .bs-content { max-width: none !important; padding: 27px 18px 36px !important; }
        .bs-page-head { align-items: center !important; }
        .bs-h1, .bs-page-head .bs-h1 { font-size: 29px !important; }
        .bs-main-search { margin: 18px 0 15px !important; }
        .bs-book-card-main { grid-template-columns: 70px minmax(0,1fr) !important; gap: 13px !important; }
        .bs-book-card-cover { width: 70px !important; min-width: 70px !important; }
        .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img { width: 70px !important; min-width: 70px !important; height: 105px !important; }
        .bs-book-card-info { min-height: 105px !important; }
        .bs-book-card h3, .bs-book-card .bs-book-title { padding-right: 0 !important; }
        .bs-book-card-readers { position: static !important; justify-content: flex-start !important; max-width: none !important; margin-top: 8px !important; }
        .bs-reader-name { max-width: 56px !important; }
        .bs-record-cta { width: 38px !important; min-width: 38px !important; padding: 0 !important; font-size: 0 !important; }
        .bs-record-cta > span:first-child { font-size: 20px !important; }
        .bs-record-cta > span:last-child { display: none !important; }
      }

      .bs-rating-input { min-width: 0 !important; flex-wrap: wrap !important; gap: 10px !important; }
      .bs-rating-stars-input { display: inline-flex !important; align-items: center !important; gap: 2px !important; }
      .bs-rating-star-button, .bs-rating-star-button:hover, .bs-rating-star-button:active { min-width: 0 !important; min-height: 0 !important; padding: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; overflow: visible !important; background: transparent !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; transform: none !important; }
      .bs-rating-star-button:focus-visible { outline: 1px solid #555555 !important; outline-offset: 2px !important; }
      .bs-rating-value { color: #333333 !important; white-space: nowrap !important; }
      /* Responsive reference layout: book-only shelf, book-centered detail, and clipping scrapbook. */

      .bs-community-shelf-page .bs-books-grid { grid-template-columns: minmax(0,1fr) !important; gap: 0 !important; border-top: 1px solid #cccccc !important; }
      .bs-community-shelf-page .bs-book-card { width: 100% !important; min-height: 0 !important; padding: 18px 0 !important; display: block !important; background: transparent !important; border: 0 !important; border-bottom: 1px solid #cccccc !important; border-radius: 0 !important; box-shadow: none !important; transform: none !important; }
      .bs-community-shelf-page .bs-book-card::before { display: none !important; content: none !important; }
      .bs-community-shelf-page .bs-book-card:hover { background: #eeeeee !important; }
      .bs-community-shelf-page .bs-book-card-main { grid-template-columns: 88px minmax(0,1fr) !important; gap: 22px !important; align-items: center !important; }
      .bs-community-shelf-page .bs-book-card-cover { width: 88px !important; min-width: 88px !important; }
      .bs-community-shelf-page .bs-book-card .bs-book-cover, .bs-community-shelf-page .bs-book-card .bs-cover-img { width: 88px !important; height: 132px !important; object-fit: cover !important; }
      .bs-community-shelf-page .bs-book-card-info { min-height: 132px !important; }
      .bs-community-shelf-page .bs-book-card h3.bs-book-title { font-size: 18px !important; }
      .bs-community-shelf-page .bs-book-card .bs-book-author { margin-top: 5px !important; font-size: 12px !important; }
      .bs-community-shelf-page .bs-book-card-quote { margin-top: 12px !important; color: #333333 !important; font-size: 12px !important; line-height: 1.8 !important; }
      .bs-community-shelf-page .bs-book-card-readers { justify-content: flex-start !important; margin-top: 12px !important; padding-top: 10px !important; }
      @media (max-width: 700px) {
        .bs-community-shelf-page .bs-book-card-main { grid-template-columns: 76px minmax(0,1fr) !important; gap: 17px !important; }
        .bs-community-shelf-page .bs-book-card-cover { width: 76px !important; min-width: 76px !important; }
        .bs-community-shelf-page .bs-book-card .bs-book-cover, .bs-community-shelf-page .bs-book-card .bs-cover-img { width: 76px !important; height: 114px !important; }
        .bs-community-shelf-page .bs-book-card-info { min-height: 114px !important; }
      }

      .bs-mobile-bottom-nav { display: none !important; }
      .bs-bookshelf-page .bs-h1, .bs-scrapbook-page .bs-h1 { font-size: clamp(32px, 4vw, 44px) !important; letter-spacing: -.05em !important; }
      .bs-bookshelf-page .bs-page-head, .bs-scrapbook-page .bs-page-head { align-items: center !important; margin-bottom: 0 !important; }
      .bs-bookshelf-page .bs-shelf-toolbar { margin-top: 32px !important; background: transparent !important; padding: 0 0 10px !important; border: 0 !important; border-bottom: 1px solid #cccccc !important; box-shadow: none !important; }
      .bs-bookshelf-page .bs-filter-btn { min-height: 34px !important; padding: 6px 9px !important; }
      .bs-bookshelf-page .bs-personal-book-list { display: grid !important; grid-template-columns: minmax(0,1fr) !important; border-top: 1px solid #cccccc !important; }
      .bs-bookshelf-page .bs-personal-book-card { width: 100% !important; min-width: 0 !important; min-height: 170px !important; padding: 18px 0 !important; display: grid !important; grid-template-columns: 88px minmax(0,1fr) 20px !important; gap: 22px !important; align-items: center !important; text-align: left !important; color: #111111 !important; background: transparent !important; border: 0 !important; border-bottom: 1px solid #cccccc !important; border-radius: 0 !important; box-shadow: none !important; transform: none !important; }
      .bs-bookshelf-page .bs-personal-book-card:hover { background: #eeeeee !important; }
      .bs-personal-book-cover, .bs-personal-book-info { min-width: 0 !important; }
      .bs-personal-book-cover .bs-book-cover, .bs-personal-book-cover .bs-cover-img { width: 88px !important; height: 132px !important; margin: 0 !important; object-fit: cover !important; }
      .bs-personal-book-title { margin: 0 !important; font-size: 18px !important; font-weight: 750 !important; line-height: 1.4 !important; overflow-wrap: anywhere !important; }
      .bs-personal-book-author { margin: 5px 0 0 !important; color: #666666 !important; font-size: 12px !important; }
      .bs-personal-book-meta { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 12px !important; margin-top: 12px !important; }
      .bs-personal-status { display: inline-flex !important; align-items: center !important; padding: 4px 7px !important; color: #555555 !important; background: #e8e8e8 !important; font-size: 10px !important; }
      .bs-status-completed { color: #ffffff !important; background: #222222 !important; }
      .bs-personal-rating { display: inline-flex !important; align-items: center !important; gap: 7px !important; font-size: 11px !important; }
      .bs-personal-rating strong { font-weight: 700 !important; }
      .bs-personal-book-date { display: block !important; margin-top: 12px !important; color: #888888 !important; font-size: 10px !important; }
      .bs-personal-book-arrow { justify-self: end !important; align-self: start !important; color: #888888 !important; font-size: 15px !important; }
      .bs-scrapbook-toolbar { margin: 42px 0 22px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 24px !important; }
      .bs-scrapbook-toolbar .bs-main-search { margin: 0 !important; width: min(420px,100%) !important; }
      .bs-scrapbook-toolbar .bs-search { height: 42px !important; min-height: 42px !important; padding-left: 34px !important; }
      .bs-scrapbook-count { color: #777777 !important; font-size: 11px !important; white-space: nowrap !important; }
      .bs-scrapbook-count strong { color: #111111 !important; font-size: 16px !important; }
      .bs-scrapbook-list { display: grid !important; grid-template-columns: minmax(0,1fr) !important; border-top: 1px solid #cccccc !important; }
      .bs-scrapbook-card { width: 100% !important; min-width: 0 !important; min-height: 0 !important; padding: 26px 0 !important; display: flex !important; align-items: flex-start !important; justify-content: space-between !important; gap: 24px !important; text-align: left !important; color: #111111 !important; background: transparent !important; border: 0 !important; border-bottom: 1px solid #cccccc !important; border-radius: 0 !important; box-shadow: none !important; transform: none !important; }
      .bs-scrapbook-card:hover { background: #eeeeee !important; }
      .bs-scrapbook-card-main { min-width: 0 !important; }
      .bs-scrapbook-label { margin: 0 0 8px !important; color: #666666 !important; font-size: 9px !important; font-weight: 700 !important; letter-spacing: .08em !important; }
      .bs-scrapbook-title { margin: 0 !important; color: #111111 !important; font-size: 18px !important; font-weight: 750 !important; line-height: 1.45 !important; overflow-wrap: anywhere !important; }
      .bs-scrapbook-source { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; margin: 7px 0 0 !important; color: #888888 !important; font-size: 10px !important; overflow-wrap: anywhere !important; }
      .bs-scrapbook-source i { font-style: normal !important; }
      .bs-scrapbook-excerpt { margin: 13px 0 0 !important; color: #444444 !important; font-size: 12px !important; line-height: 1.8 !important; white-space: pre-line !important; overflow-wrap: anywhere !important; }
      .bs-scrapbook-meta { display: flex !important; flex-wrap: wrap !important; gap: 12px !important; margin-top: 12px !important; color: #777777 !important; font-size: 10px !important; }
      .bs-scrapbook-arrow { flex-shrink: 0 !important; color: #777777 !important; font-size: 15px !important; }
      .bs-book-detail-page { width: min(100%, 900px) !important; max-width: 900px !important; padding-top: 30px !important; }
      .bs-book-detail-shell { border: 0 !important; background: transparent !important; box-shadow: none !important; }
      .bs-book-detail-hero { margin-top: 28px !important; padding: 0 0 34px !important; display: grid !important; grid-template-columns: 140px minmax(0,1fr) !important; align-items: end !important; gap: 34px !important; border: 0 !important; border-bottom: 1px solid #cccccc !important; background: transparent !important; box-shadow: none !important; }
      .bs-book-detail-cover { width: 140px !important; height: 208px !important; min-width: 0 !important; object-fit: cover !important; border: 1px solid #bbbbbb !important; background: #e7e7e7 !important; }
      .bs-book-detail-hero h2 { font-size: clamp(30px,4vw,44px) !important; font-weight: 800 !important; line-height: 1.2 !important; letter-spacing: -.05em !important; }
      .bs-book-detail-hero > div > div > div > button { min-height: 32px !important; }
      .bs-book-rating-section { padding: 30px 0 !important; display: grid !important; grid-template-columns: 90px minmax(0,1fr) !important; gap: 30px !important; border-bottom: 1px solid #cccccc !important; }
      .bs-book-rating-heading { margin: 0 !important; font-size: 15px !important; font-weight: 800 !important; }
      .bs-book-rating-content { min-width: 0 !important; display: grid !important; gap: 10px !important; }
      .bs-book-rating-row { display: grid !important; grid-template-columns: minmax(70px,100px) minmax(90px,1fr) 38px !important; align-items: center !important; gap: 10px !important; color: #555555 !important; font-size: 11px !important; }
      .bs-book-rating-name { min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .bs-book-rating-row strong { color: #222222 !important; font-size: 11px !important; }
      .bs-book-rating-empty { margin: 0 !important; color: #777777 !important; font-size: 12px !important; }
      .bs-book-my-rating { margin-top: 6px !important; padding-top: 14px !important; display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 14px !important; border-top: 1px solid #dddddd !important; color: #555555 !important; font-size: 11px !important; }
      .bs-book-my-rating > p { margin: 0 !important; color: #777777 !important; }
      .bs-book-detail-sections { display: block !important; }
      .bs-book-detail-section { padding: 34px 0 !important; border-bottom: 1px solid #cccccc !important; background: transparent !important; }
      .bs-book-detail-section h3 { margin: 0 !important; font-size: 15px !important; font-weight: 800 !important; }
      .bs-book-community-panel { padding: 28px 0 !important; border: 0 !important; border-bottom: 1px solid #cccccc !important; background: transparent !important; }
      .bs-scrap-detail-page .bs-content { max-width: 1000px !important; }
      .bs-scrap-detail-page .scrap-detail-article { border: 0 !important; background: transparent !important; box-shadow: none !important; }
      .bs-scrap-detail-page .scrap-detail-header { margin-top: 42px !important; padding: 0 0 34px !important; border: 0 !important; border-bottom: 1px solid #cccccc !important; background: transparent !important; }
      .bs-scrap-detail-page .scrap-detail-content { width: min(640px,100%) !important; margin: 0 auto !important; padding: 36px 0 !important; border: 0 !important; background: transparent !important; font-size: 14px !important; line-height: 2 !important; }
      .bs-scrap-detail-page .scrap-detail-content .ProseMirror { font-size: 14px !important; }
      .bs-modal-backdrop { position: fixed !important; inset: 0 !important; z-index: 100 !important; display: flex !important; align-items: center !important; justify-content: center !important; overflow-y: auto !important; padding: 20px !important; background: rgba(17,17,17,.55) !important; }
      .bs-modal-panel { width: min(620px,100%) !important; max-height: min(88vh,900px) !important; overflow-y: auto !important; margin: auto !important; padding: 24px !important; color: #111111 !important; background: #f7f7f7 !important; border: 1px solid #cccccc !important; box-shadow: 0 12px 40px rgba(0,0,0,.18) !important; }
      .bs-modal-head { display: flex !important; align-items: flex-start !important; justify-content: space-between !important; gap: 16px !important; margin-bottom: 24px !important; padding-bottom: 14px !important; border-bottom: 1px solid #cccccc !important; }
      .bs-modal-eyebrow { margin: 0 0 5px !important; color: #777777 !important; font-size: 9px !important; letter-spacing: .08em !important; }
      .bs-modal-head h2 { margin: 0 !important; font-size: 23px !important; font-weight: 800 !important; }
      .bs-book-search-form { margin-bottom: 22px !important; }
      .bs-book-search-results { margin-top: 18px !important; border-top: 1px solid #cccccc !important; }
      .bs-book-search-result { padding: 12px 0 !important; display: grid !important; grid-template-columns: 44px minmax(0,1fr) auto !important; gap: 12px !important; align-items: center !important; border-bottom: 1px solid #dddddd !important; }
      .bs-book-search-result img, .bs-selected-book img { width: 44px !important; height: 64px !important; object-fit: cover !important; background: #e7e7e7 !important; border: 1px solid #cccccc !important; }
      .bs-selected-book { margin-top: 18px !important; padding-top: 18px !important; border-top: 1px solid #cccccc !important; }
      .bs-selected-book img { width: 56px !important; height: 80px !important; }
      .bs-add-scrap > span:first-child, .bs-book-add-button > span:first-child { font-size: 20px !important; }
      .bs-add-scrap, .bs-book-add-button { display: inline-flex !important; align-items: center !important; gap: 8px !important; }
      @media (max-width: 700px) {
        .bs-sidebar { position: sticky !important; inset: 0 auto auto 0 !important; width: 100% !important; min-height: 0 !important; height: auto !important; padding: 10px 14px 9px !important; display: block !important; border: 0 !important; border-bottom: 1px solid #dddddd !important; }
        .bs-brand { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 2px !important; }
        .bs-brand-title { font-size: 24px !important; line-height: .95 !important; }
        .bs-sidebar .bs-side-spacer, .bs-sidebar .bs-side-bottom { display: none !important; }
        .bs-sidebar .bs-nav { display: none !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-nav { display: flex !important; flex-direction: column !important; gap: 2px !important; margin-top: 10px !important; }
        .bs-sidebar.bs-mobile-nav-open .bs-side-bottom { display: flex !important; margin-top: 14px !important; }
        .bs-main { width: 100% !important; margin-left: 0 !important; }
        .bs-content { max-width: none !important; padding: 38px 20px 108px !important; }
        .bs-mobile-bottom-nav { position: fixed !important; inset: auto 12px 12px !important; z-index: 90 !important; min-height: 64px !important; padding: 6px !important; display: grid !important; grid-template-columns: repeat(3,minmax(0,1fr)) !important; background: #111111 !important; border: 1px solid #333333 !important; }
        .bs-mobile-bottom-nav button { min-height: 50px !important; padding: 8px 4px !important; color: #999999 !important; background: transparent !important; border: 0 !important; box-shadow: none !important; font-size: 10px !important; }
        .bs-mobile-bottom-nav button.bs-active { color: #ffffff !important; background: #333333 !important; }
        .bs-bookshelf-page .bs-personal-book-card { min-height: 148px !important; grid-template-columns: 76px minmax(0,1fr) 14px !important; gap: 17px !important; padding: 17px 0 !important; }
        .bs-personal-book-cover .bs-book-cover, .bs-personal-book-cover .bs-cover-img { width: 76px !important; height: 114px !important; }
        .bs-personal-book-title { font-size: 16px !important; }
        .bs-scrapbook-toolbar { margin-top: 30px !important; align-items: stretch !important; flex-direction: column !important; gap: 10px !important; }
        .bs-scrapbook-toolbar .bs-main-search { width: 100% !important; }
        .bs-scrapbook-count { text-align: right !important; }
        .bs-scrapbook-card { padding: 22px 0 !important; gap: 12px !important; }
        .bs-scrapbook-title { font-size: 16px !important; }
        .bs-book-detail-page { padding-top: 22px !important; padding-bottom: 100px !important; }
        .bs-book-detail-hero { margin-top: 28px !important; grid-template-columns: 98px minmax(0,1fr) !important; gap: 20px !important; padding-bottom: 28px !important; }
        .bs-book-detail-cover { width: 98px !important; height: 146px !important; }
        .bs-book-detail-hero h2 { font-size: 28px !important; }
        .bs-book-rating-section { padding: 26px 0 !important; grid-template-columns: 1fr !important; gap: 16px !important; }
        .bs-book-rating-row { grid-template-columns: minmax(58px,90px) minmax(88px,1fr) 32px !important; gap: 7px !important; }
        .bs-book-detail-section { padding: 28px 0 !important; }
        .bs-scrap-detail-page .bs-content { padding: 30px 18px 100px !important; }
        .bs-scrap-detail-page .scrap-detail-header { margin-top: 30px !important; }
        .bs-scrap-detail-page .scrap-detail-content { padding: 28px 0 !important; }
        .bs-modal-panel { padding: 18px !important; }
        .bs-add-scrap, .bs-book-add-button { width: 42px !important; min-width: 42px !important; padding: 0 !important; justify-content: center !important; font-size: 0 !important; }
        .bs-add-scrap > span:first-child, .bs-book-add-button > span:first-child { font-size: 22px !important; }
      }
      @media (max-width: 430px) {
        .bs-personal-book-arrow { display: none !important; }
        .bs-personal-book-card { grid-template-columns: 70px minmax(0,1fr) !important; gap: 13px !important; }
        .bs-personal-book-cover .bs-book-cover, .bs-personal-book-cover .bs-cover-img { width: 70px !important; height: 105px !important; }
        .bs-book-detail-hero { grid-template-columns: 84px minmax(0,1fr) !important; gap: 14px !important; }
        .bs-book-detail-cover { width: 84px !important; height: 126px !important; }
        .bs-book-detail-hero h2 { font-size: 24px !important; }
        .bs-modal-panel { padding: 15px !important; }
      }
      /* Final usability fixes: preserve width, soften controls, and keep side gutters. */
      .bs-book-detail-page {
        box-sizing: border-box !important;
        width: min(100%, 900px) !important;
        max-width: 900px !important;
        padding-left: clamp(22px, 4vw, 46px) !important;
        padding-right: clamp(22px, 4vw, 46px) !important;
      }
      .bs-book-detail-hero {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
      }
      .bs-book-detail-hero > div:first-child {
        display: grid !important;
        grid-template-columns: 140px minmax(0, 1fr) !important;
        align-items: start !important;
        gap: 28px !important;
        width: 100% !important;
        min-width: 0 !important;
      }
      .bs-book-detail-hero > div:first-child > img {
        width: 140px !important;
        height: 208px !important;
      }
      .bs-book-detail-hero > div:first-child > div {
        width: 100% !important;
        min-width: 0 !important;
      }
      .bs-book-detail-hero > div:first-child > div > div:first-child,
      .bs-book-detail-hero > div:first-child > div > div:first-child > div:first-child {
        min-width: 0 !important;
      }
      .bs-book-detail-hero h2 {
        max-width: 100% !important;
        font-size: clamp(23px, 3vw, 36px) !important;
        line-height: 1.35 !important;
        font-weight: 600 !important;
        letter-spacing: -.035em !important;
        overflow-wrap: break-word !important;
        word-break: normal !important;
      }
      .bs-content {
        padding-left: clamp(24px, 4vw, 54px) !important;
        padding-right: clamp(24px, 4vw, 54px) !important;
      }
      .bs-delete-x {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 25px !important;
        min-width: 25px !important;
        height: 25px !important;
        min-height: 25px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: transparent !important;
        color: #d9364f !important;
        box-shadow: none !important;
        font-size: 22px !important;
        font-weight: 400 !important;
        line-height: 1 !important;
        cursor: pointer !important;
      }
      .bs-delete-x:hover { background: rgba(217,54,79,.09) !important; color: #b91c35 !important; }
      .bs-highlight-color {
        display: inline-block !important;
        width: 9px !important;
        height: 9px !important;
        border-radius: 50% !important;
        margin-top: 6px !important;
      }
      .bs-highlight-records h3 { font-weight: 500 !important; }
      .bs-highlight-record p { margin: 0 !important; font-weight: 400 !important; }
      .bs-book-rating-heading, .bs-book-detail-section h3 { font-weight: 600 !important; }
      button:not(.bs-mobile-bottom-nav button):not(.bs-nav button):not(.bs-rating-star-button):not(.bs-delete-x):not(.bs-personal-book-card):not(.bs-scrapbook-card):not(.bs-active):not([aria-pressed="true"]) {
        background-color: transparent !important;
        font-weight: 400 !important;
        font-size: 11px !important;
        box-shadow: none !important;
      }
      .bs-btn, .bs-btn-primary, .bs-btn-small, .bs-btn-outline, .bs-filter-btn,
      .bs-link-button, .bs-icon-button, .bs-add-scrap, .bs-book-add-button,
      .bs-book-detail-hero button, .bs-book-my-rating button,
      .bs-book-search-form button, .bs-book-search-result button, .bs-selected-book button {
        background-color: transparent !important;
        color: inherit !important;
        font-weight: 400 !important;
        font-size: 11px !important;
        box-shadow: none !important;
        transform: none !important;
        border-radius: 3px !important;
      }
      .bs-btn, .bs-btn-primary, .bs-btn-small, .bs-book-detail-hero button,
      .bs-book-my-rating button, .bs-book-search-form button, .bs-book-search-result button,
      .bs-selected-book button { min-height: 34px !important; }
      .bs-icon-button, .bs-add-scrap, .bs-book-add-button { min-height: 34px !important; }
      .bs-btn:hover, .bs-btn-primary:hover, .bs-btn-small:hover,
      .bs-link-button:hover, .bs-filter-btn:hover, .bs-icon-button:hover,
      .bs-add-scrap:hover, .bs-book-add-button:hover {
        background-color: rgba(0,0,0,.035) !important;
        color: inherit !important;
      }
      .scrap-detail-article { min-width: 0 !important; width: 100% !important; }
      .scrap-detail-header h2 { font-size: clamp(22px, 3vw, 32px) !important; font-weight: 600 !important; }
      .scrap-detail-content { min-width: 0 !important; overflow-wrap: anywhere !important; }
      .scrap-detail-article a { text-decoration-color: #d9364f !important; text-decoration-thickness: 1px !important; }
      @media (max-width: 700px) {
        .bs-content { padding-left: 18px !important; padding-right: 18px !important; }
        .bs-book-detail-page { padding-left: 18px !important; padding-right: 18px !important; }
        .bs-book-detail-hero > div:first-child {
          grid-template-columns: 98px minmax(0, 1fr) !important;
          gap: 18px !important;
        }
        .bs-book-detail-hero > div:first-child > img { width: 98px !important; height: 146px !important; }
        .bs-book-detail-hero h2 { font-size: clamp(21px, 5vw, 28px) !important; }
        .bs-book-detail-hero > div:first-child > div > div:first-child { gap: 8px !important; }
        .bs-book-detail-hero > div:first-child > div > div:first-child > div:last-child { max-width: 100% !important; }
        .bs-scrap-detail-page .bs-content { padding-left: 18px !important; padding-right: 18px !important; }
        .bs-highlight-records { padding-left: 0 !important; padding-right: 0 !important; }
      }
      @media (max-width: 430px) {
        .bs-content { padding-left: 15px !important; padding-right: 15px !important; }
        .bs-book-detail-page { padding-left: 15px !important; padding-right: 15px !important; }
        .bs-book-detail-hero > div:first-child { grid-template-columns: 84px minmax(0, 1fr) !important; gap: 13px !important; }
        .bs-book-detail-hero > div:first-child > img { width: 84px !important; height: 126px !important; }
        .bs-book-detail-hero h2 { font-size: 22px !important; }
      }
    `}</style>
  );
}

const STAR_PATH =
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

function Star({ fill, size = 20 }: { fill: number; size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="absolute inset-0 text-[#e4e6e9]"
        fill="currentColor"
      >
        <path d={STAR_PATH} />
      </svg>
      <span
        className="absolute left-0 top-0 h-full overflow-hidden text-[#202328]"
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
    <div className="bs-rating-input flex items-center gap-3" aria-label="별점 선택">
      <div className="bs-rating-stars-input" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className="bs-rating-star-button"
            style={{ width: size, height: size }}
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
      <span className="bs-rating-value text-sm font-semibold">
        {value > 0 ? `${value.toFixed(1)}점` : '별점 선택'}
      </span>
    </div>
  );
}

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
      className={`${pressed ? BTN_ACTIVE : BTN_OUTLINE} ${className}`}
    >
      {children}
    </button>
  );
}

function ReadingBadge() {
  return (
    <span className="inline-block bg-[#26292e] px-2 py-0.5 text-[11px] font-semibold tracking-widest text-white">
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
      className="mt-1 shrink-0 text-[#969ba2]"
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
      onClick={(e) => {
        e.stopPropagation();
        setShown(true);
      }}
      className={`px-0.5 ${shown ? 'bg-[#e4e6e9]' : 'bg-[#34373d] cursor-pointer select-none'}`}
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

const INLINE: InlinePattern[] = [
  { re: /\\([\\*_~`|>#\[\]()\-])/, render: (m) => m[1] },
  {
    re: /(`{1,3})([\s\S]+?)\1/,
    render: (m, key) => (
      <code
        key={key}
        className="px-1 py-0.5 bg-[#e4e6e9] text-[0.85em] font-normal not-italic text-[#202328]"
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
        className="underline decoration-2 decoration-[#26292e] underline-offset-4"
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
        className="underline decoration-2 decoration-[#26292e] underline-offset-4 break-all"
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
            className="my-1 p-3 border border-[#d5d7da] bg-[#e4e6e9] text-xs font-normal not-italic text-[#202328] whitespace-pre overflow-x-auto"
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
        <blockquote key={key()} className="my-1 border-l border-[#d5d7da] pl-3 text-[#555a62]">
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
        <blockquote key={key()} className="my-1 border-l border-[#d5d7da] pl-3 text-[#555a62]">
          {renderBlocks(q.join('\n'), key())}
        </blockquote>
      );
      continue;
    }

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

    const sub = trimmed.match(/^-#\s+(.+)$/);
    if (sub) {
      flush();
      const kk = key();
      out.push(
        <p key={kk} className="text-xs text-[#666b73]">
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
        <ul key={kk} className="list-disc pl-5 my-1">
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

const BLOCK_SYNTAX = /^\s*(#{1,3}\s|-#\s|>|[-*]\s|\d+[.)]\s)|```/m;

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
    <div className="divide-y divide-[#e4e6e9]">
      {quotes.map((q) => (
        <div key={q.id} className="py-4 first:pt-0">
          <div className="flex justify-between items-start gap-3">
            <div
              onClick={isOwner ? () => toggle(q.id) : undefined}
              className={`min-w-0 text-base font-bold italic leading-relaxed ${
                isOwner ? 'cursor-pointer hover:text-[#26292e] transition-colors duration-200' : ''
              }`}
            >
              <DiscordText text={q.content} wrapQuotes />
            </div>
            {onDeleteQuote && (
              <button
                type="button"
                onClick={() => onDeleteQuote(q.id)}
                className="bs-delete-x shrink-0"
                aria-label="인용문 삭제"
                title="인용문 삭제"
              >
                ×
              </button>
            )}
          </div>

          {q.quote_comments.length > 0 && (
            <div className="mt-2 ml-2 space-y-1.5">
              {q.quote_comments.map((c) => (
                <div key={c.id} className="flex items-start gap-1.5 text-sm text-[#555a62]">
                  <ReplyIcon />
                  <DiscordText text={c.content} className="flex-1 min-w-0 leading-relaxed" />
                  {isOwner && onDeleteComment && (
                    <button
                      type="button"
                      onClick={() => onDeleteComment(c.id)}
                      className="bs-delete-x shrink-0"
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
  const hex = (SEAL_COLORS[color] ?? SEAL_COLORS.ink).hex;
  const w = Math.max(1, Math.round(size / 28));

  if (image) {
    return (
      <span
        aria-hidden="true"
        className="inline-block shrink-0 overflow-hidden bg-[#e7e9ec]"
        style={{ width: size, height: size, border: `${w}px solid ${hex}`, transform: 'rotate(-4deg)' }}
      >
        <img
          src={image}
          alt=""
          onError={onImageError}
          className="block w-full h-full object-cover"
        />
      </span>
    );
  }
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
      boxShadow: `inset 0 0 0 ${w}px #fafafa, inset 0 0 0 ${w * 2}px ${hex}`,
    };
  } else {
    extra = { color: '#fafafa', background: hex, border: `${w}px solid ${hex}` };
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

function WishBadge() {
  return (
    <span className="inline-block border border-[#d5d7da] px-2 py-0.5 text-[11px] font-semibold tracking-widest">
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

const HL_COLORS: Record<string, string> = {
  red: 'rgba(230, 45, 70, 0.24)',
  blue: 'rgba(45, 125, 235, 0.23)',
};

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

      out.push(
        <span
          key={`s${a}`}
          data-start={a}
          style={color ? { backgroundColor: HL_COLORS[color] } : undefined}
          className={noted ? 'underline decoration-[#d9364f] decoration-2 underline-offset-4' : undefined}
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
              className="ml-0.5 cursor-pointer text-[11px] font-black hover:text-[#26292e]"
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
  const guide = 'rgba(255, 255, 255, 0.55)';
  const thirds = `linear-gradient(to right, transparent calc(33.33% - 0.5px), ${guide} calc(33.33% - 0.5px), ${guide} calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), ${guide} calc(66.66% - 0.5px), ${guide} calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)), linear-gradient(to bottom, transparent calc(33.33% - 0.5px), ${guide} calc(33.33% - 0.5px), ${guide} calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), ${guide} calc(66.66% - 0.5px), ${guide} calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))`;

  return (
    <div className="mt-3 border border-[#d5d7da] p-3 space-y-3">
      <p className={LABEL}>사진 자르기</p>

      <div className="flex flex-wrap items-start gap-4">
        <div
          ref={viewRef}
          className="relative shrink-0 overflow-hidden border border-[#d5d7da] bg-[#e7e9ec] cursor-grab active:cursor-grabbing select-none"
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
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: thirds }} />
        </div>

        <div className="min-w-0 space-y-2">
          <p className={LABEL}>미리보기</p>
          <div className="flex items-end gap-3">
            <Seal text="" color={sealColor} image={previewUrl} size={88} />
            <Seal text="" color={sealColor} image={previewUrl} size={48} />
            <Seal text="" color={sealColor} image={previewUrl} size={26} />
          </div>
          <p className="text-xs text-[#666b73]">실제로 이렇게 기울어진 도장으로 보여요.</p>
        </div>
      </div>

      <div>
        <label className={LABEL}>확대</label>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            aria-label="축소"
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
            className={`${BTN_OUTLINE} !min-w-[36px] !px-0 shrink-0`}
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
            className="flex-1 min-w-0 accent-[#202328]"
          />
          <button
            type="button"
            aria-label="확대"
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
            className={`${BTN_OUTLINE} !min-w-[36px] !px-0 shrink-0`}
          >
            +
          </button>
          <span className="w-11 shrink-0 text-right text-xs font-semibold">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      <p className="text-xs text-[#666b73]">
        사진을 드래그해서 위치를 맞추고, 슬라이더나 마우스 휠(휴대폰은 두 손가락)로 확대해요.
      </p>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={BTN_OUTLINE}>
          취소
        </button>
        <button type="button" onClick={confirm} className={BTN}>
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

const COVER_COLORS = ['#717171', '#676767', '#666666', '#545454', '#8a8a8a', '#d2d5d9', '#636363'];

function BookCover({
  title,
  author,
  src,
  width = 58,
}: {
  title: string;
  author?: string;
  src?: string | null;
  width?: number;
}) {
  const [broken, setBroken] = useState(false);
  const height = Math.round(width * 1.36);

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={title}
        onError={() => setBroken(true)}
        className="bs-cover-img"
        style={{ width, height }}
      />
    );
  }

  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = COVER_COLORS[hash % COVER_COLORS.length];
  const light = bg === '#d2d5d9';

  return (
    <div
      className="bs-book-cover"
      style={{ width, height, background: bg, color: light ? '#434343' : '#eaeaea' }}
    >
      <div className="bs-cover-inner">
        <div
          className="bs-cover-title"
          style={{ fontSize: Math.max(8, Math.round(width * 0.17)), maxHeight: Math.round(height * 0.62) }}
        >
          {title}
        </div>
        {author && (
          <div className="bs-cover-author" style={{ fontSize: Math.max(5, Math.round(width * 0.08)) }}>
            {author}
          </div>
        )}
      </div>
    </div>
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
  return <EditorContent editor={editor} className="bs-prose" />;
}

function ReviewBody({ review }: { review: Review }) {
  if (review.content_json) return <RichView json={review.content_json} />;
  return <DiscordText text={review.content} className="text-sm leading-relaxed text-[#454545]" />;
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
      disabled={disabled || !editor}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`${on ? BTN_ACTIVE : BTN_OUTLINE} !min-h-[30px] !px-2.5 disabled:opacity-40`}
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
    <div className="space-y-3">
      {review.content && (
        <p className="text-xs text-[#666b73]">
          발행된 글을 고치는 중이에요. 발행하기 전까지는 다른 멤버에게 이전에 발행한 글이 보여요.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
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

      <div className={preview ? 'hidden' : 'bs-prose bs-editor-box'}>
        <EditorContent editor={editor} />
      </div>
      {preview && (
        <div className="bs-prose border border-[#d5d7da] p-4 min-h-[240px]">
          <RichView json={previewDoc} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={`text-xs ${saveState === 'error' ? 'font-semibold text-[#26292e]' : 'text-[#666b73]'}`}
          role="status"
        >
          {statusText}
          {saveState === 'error' && (
            <button type="button" onClick={saveNow} className={`${LINK_BTN} ml-2`}>
              다시 시도
            </button>
          )}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {draft && (
            <button type="button" onClick={discard} className={DANGER_BTN}>
              임시 저장 삭제
            </button>
          )}
          <button type="button" onClick={togglePreview} className={BTN_OUTLINE}>
            {preview ? '편집으로' : '미리보기'}
          </button>
          <button type="button" onClick={saveNow} disabled={saveState === 'saving'} className={BTN_OUTLINE}>
            임시 저장
          </button>
          <button type="button" onClick={close} className={BTN_OUTLINE}>
            닫기
          </button>
          <button type="button" onClick={publish} disabled={busy} className={BTN}>
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

  const handleDeleteHighlight = async (highlightId: string) => {
    if (!activeClip || !user || !confirm('이 형광펜을 삭제하시겠습니까?')) return;
    const { error } = await supabase
      .from('clip_highlights')
      .delete()
      .eq('id', highlightId)
      .eq('clipping_id', activeClip.id)
      .eq('user_id', user.id);
    if (error) return alert(`형광펜 삭제 실패: ${error.message}`);
    setClippings((prev) =>
      prev.map((c) =>
        c.id === activeClip.id
          ? { ...c, clip_highlights: c.clip_highlights.filter((h) => h.id !== highlightId) }
          : c
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
      <main className="min-h-screen flex items-center justify-center p-4 text-[#202328]">
        <GlobalStyle />
        <div className="w-full max-w-md border border-[#d5d7da] bg-[#fafafa] p-8">
          <h1 className="text-center text-5xl font-black tracking-tighter leading-none border-b border-[#d5d7da] pb-4">
            독-서팟
          </h1>
          {isSignUp && (
            <p className="text-center text-sm text-[#555a62] mt-4 mb-8">
              새로운 계정 생성하기
            </p>
          )}

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

  const renderByline = (userId: string, size = 18, className = '') => {
    const p = profileOf(userId);
    return (
      <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
        <Seal text={p.seal_text} color={p.seal_color} styleType={p.seal_style} image={p.seal_image} size={size} />
        <span className="truncate">{p.nickname}</span>
      </span>
    );
  };

  const writtenAll = allReviews.filter((r) => r.content.trim());
  const pad2 = (n: number) => String(n).padStart(2, '0');

  const navItem = (t: Tab, label: string, count?: number) => (
    <button
      key={t}
      type="button"
      className={tab === t ? 'bs-active' : ''}
      onClick={() => { goTab(t); setMobileNavOpen(false); }}
      aria-current={tab === t ? 'page' : undefined}
    >
      <span>{label}</span>
      {count !== undefined && tab === t && <span className="bs-nav-count">{count}</span>}
    </button>
  );

  const boardSearch = (
    <div className="bs-search-wrap bs-main-search">
      <span className="bs-search-icon" aria-hidden="true">⌕</span>
      <input
        id="archive-search"
        className="bs-search"
        type="search"
        value={boardFilter}
        onChange={(e) => setBoardFilter(e.target.value)}
        placeholder="책 제목 또는 저자 검색"
        aria-label="책 제목 또는 저자 검색"
      />
      {boardFilter && (
        <button
          type="button"
          className="bs-search-clear"
          onClick={() => setBoardFilter('')}
          aria-label="검색어 지우기"
          title="검색어 지우기"
        >×</button>
      )}
    </div>
  );

  const header = (
    <>
    <aside className={`bs-sidebar${mobileNavOpen ? ' bs-mobile-nav-open' : ''}`}>
      <div className="bs-brand">
        <div className="bs-brand-title">독-<br />서팟</div>
        <button
          type="button"
          className="bs-mobile-menu-toggle"
          aria-label={mobileNavOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            {mobileNavOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>
      <nav className="bs-nav" aria-label="주 메뉴">
        {navItem('shelf', '서고', shelfEntries.length)}
        {navItem('mine', '책장')}
        {navItem('scraps', '스크랩북')}
      </nav>
      <div className="bs-side-spacer" />
      <div className="bs-side-bottom">
        <button
          type="button"
          className="bs-profile-settings"
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
          <span className="bs-profile-name">{profileOf(user.id).nickname}</span>
          <svg className="bs-settings-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 1.8-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-2.55v-.11a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-1.8-1.8.06-.06A1.7 1.7 0 0 0 8.17 15a1.7 1.7 0 0 0-1.55-1H6.5v-2.55h.12a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.8-1.8.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V5.5h2.55v.12a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.8 1.8-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.55 1h.12v2.55h-.12a1.7 1.7 0 0 0-1.55 1Z" />
          </svg>
        </button>
        <button
          type="button"
          className="bs-logout-icon"
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
    <nav className="bs-mobile-bottom-nav" aria-label="모바일 메뉴">
      {navItem('shelf', '서고')}
      {navItem('mine', '책장')}
      {navItem('scraps', '스크랩북')}
    </nav>
    </>
  );

  const asRows = (list: Review[]): CommunityEntry[] =>
    list.map((review) => ({ type: 'review', review }));

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

  const renderBoard = (rows: CommunityEntry[], showAuthor: boolean) => {
    const col = showAuthor
      ? { title: 'sm:col-span-4', author: 'sm:col-span-2', nick: 'sm:col-span-2', status: 'sm:col-span-3', date: 'sm:col-span-1' }
      : { title: 'sm:col-span-6', author: 'sm:col-span-3', nick: '', status: 'sm:col-span-2', date: 'sm:col-span-1' };
    const rowClass =
      'grid grid-cols-12 gap-3 items-center px-5 py-3 border-b border-[#d5d7da] last:border-b-0 hover:bg-[#e9ebee] cursor-pointer transition-colors duration-200 group';
    const coverClass =
      'w-9 h-12 object-cover border border-[#d5d7da] bg-[#e7e9ec] transition duration-200 shrink-0';
    const titleClass =
      'font-bold text-sm truncate underline-offset-4 decoration-2 decoration-[#26292e] group-hover:underline';

    return (
      <>
        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2 bg-[#eceef0] text-[#666b73] text-[11px] font-semibold uppercase tracking-widest">
          <span className={col.title}>책 제목</span>
          <span className={col.author}>저자</span>
          {showAuthor && <span className={col.nick}>읽은이</span>}
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
                      <span className="block text-[11px] text-[#666b73]">
                        시리즈 &middot; 기록된 {row.volumes.length}권
                      </span>
                    </span>
                  </div>
                  <span className={`col-span-6 ${col.author} text-xs text-[#555a62] truncate`}>
                    {row.author}
                  </span>
                  {showAuthor && (
                    <span className={`col-span-6 ${col.nick} text-xs font-semibold min-w-0 flex items-center gap-1`}>
                      {renderByline(userIds[0], 18)}
                      {userIds.length > 1 && (
                        <span className="shrink-0 text-[#666b73]">외 {userIds.length - 1}명</span>
                      )}
                    </span>
                  )}
                  <div className={`col-span-6 ${col.status} flex sm:justify-center`}>
                    <span className="inline-block bg-[#34373d] px-2 py-0.5 text-[11px] font-semibold tracking-widest text-[#fafafa]">
                      시리즈
                    </span>
                  </div>
                  <span className={`hidden sm:block ${col.date} text-right text-[11px] text-[#666b73]`}>
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
                <span className={`col-span-6 ${col.author} text-xs text-[#555a62] truncate`}>
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
                <span className={`hidden sm:block ${col.date} text-right text-[11px] text-[#666b73]`}>
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

  if (activeReview) {
    const hasQuotes = (activeReview.quotes?.length || 0) > 0;
    const showReview = (isEditingContent && isOwner) || !!activeReview.content || (isOwner && !!drafts[activeReview.id]);
    const showQuotes = isOwner || hasQuotes;
    const sameBookReviews = allReviews.filter((r) => r.book_isbn === activeReview.book_isbn);
    const myBookReview = sameBookReviews.find((r) => r.user_id === user.id) ?? null;
    const readers = otherReviews.filter((r) => r.status !== 'wishlist');
    const hasSidebar = readers.length > 0;
    const seriesEntry = activeSeries
      ? buildCommunityEntries(allReviews).find(
          (e): e is SeriesEntry => e.type === 'series' && e.key === activeSeries
        )
      : undefined;

    return (
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <main className="bs-book-detail-page max-w-[900px] mx-auto px-4 py-6 md:py-8">
          <button onClick={goBack} className={`${LINK_BTN} min-h-[34px]`}>
            &larr; 목록으로 돌아가기
          </button>

          {seriesEntry && (
            <div className="border border-[#d5d7da] bg-[#fafafa] px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-[#666b73]">Series</p>
              <p className="font-black tracking-tight break-words">{seriesEntry.base}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {seriesEntry.volumes.map((v) => (
                  <ToggleButton
                    key={v.volume}
                    pressed={v.reviews.some((r) => r.id === activeReview.id)}
                    onClick={() => openVolume(v)}
                    className="!min-h-[28px] !px-3"
                  >
                    {v.label}
                  </ToggleButton>
                ))}
              </div>
            </div>
          )}

          <article className="bs-book-detail-shell">
            <section className="bs-book-detail-hero p-5 md:p-6 border-b border-[#d5d7da]">
              <div className="flex gap-4 sm:gap-5">
                <img
                  src={activeReview.books.cover_url || undefined}
                  alt={activeReview.books.title}
                  className="bs-book-detail-cover w-20 h-28 sm:w-24 sm:h-36 object-cover border border-[#d5d7da] bg-[#e7e9ec] transition duration-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#666b73]">
                        {renderByline(activeReview.user_id, 20, 'font-semibold text-[#202328]')}
                        <span>&middot; {new Date(activeReview.created_at).toLocaleDateString('ko-KR')}</span>
                      </p>
                      <h2 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight break-words">
                        {activeReview.books.title}
                      </h2>
                      <p className="mt-1 text-sm text-[#555a62]">{activeReview.books.author}</p>
                      {!isOwner && <div className="mt-3"><StatusCell review={activeReview} /></div>}
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
                            {drafts[activeReview.id] ? '이어서 쓰기' : '독후감 추가'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </section>

            <section className="bs-book-rating-section">
              <h3 className="bs-book-rating-heading">별점</h3>
              <div className="bs-book-rating-content">
                {sameBookReviews.filter((r) => r.status === 'completed' && r.rating > 0).length > 0 ? (
                  sameBookReviews
                    .filter((r) => r.status === 'completed' && r.rating > 0)
                    .map((r) => (
                      <div className="bs-book-rating-row" key={r.id}>
                        <span className="bs-book-rating-name">{profileOf(r.user_id).nickname}</span>
                        <RatingDisplay value={r.rating} size={15} />
                        <strong>{r.rating.toFixed(1)}</strong>
                      </div>
                    ))
                ) : (
                  <p className="bs-book-rating-empty">아직 등록된 별점이 없어요.</p>
                )}

                <div className="bs-book-my-rating">
                  <span>내 별점</span>
                  {myBookReview?.status === 'completed' ? (
                    <RatingInput
                      value={myBookReview.rating}
                      onChange={(v) => handleUpdateStatus('completed', v, myBookReview)}
                      size={25}
                    />
                  ) : myBookReview ? (
                    <p>완독으로 상태를 바꾸면 별점을 남길 수 있어요.</p>
                  ) : (
                    <button
                      type="button"
                      className={LINK_BTN}
                      onClick={() => { goTab('mine'); setBookModalOpen(true); }}
                    >
                      내 책장에 추가하기
                    </button>
                  )}
                </div>
              </div>
            </section>

            <div className="bs-book-detail-sections">
              <div>
                {showQuotes && (
                  <section className={`bs-book-detail-section ${showReview ? 'border-b border-[#d5d7da]' : ''}`}>
                    <h3 className="text-xl font-black tracking-tight">
                      인용문{' '}
                      <span className="text-sm font-semibold text-[#666b73]">
                        ({activeReview.quotes?.length || 0})
                      </span>
                    </h3>
                    {isOwner && hasQuotes && (
                      <p className="mt-1 text-xs text-[#666b73]">인용문을 누르면 코멘트를 달 수 있어요.</p>
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
                        <p className="text-sm text-[#666b73]">아직 추가된 인용문이 없습니다.</p>
                      )}
                    </div>

                    {isOwner && (
                      <form
                        onSubmit={handleAddQuote}
                        className="mt-5 pt-5 border-t border-[#d5d7da] flex gap-3 items-end"
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

                {isEditingContent && isOwner ? (
                  <section id="review-editor" className="bs-book-detail-section space-y-3">
                    <h3 className="text-xl font-black tracking-tight">독후감</h3>
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
                  <section className="bs-book-detail-section space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <h3 className="text-xl font-black tracking-tight">독후감</h3>
                      {isOwner && (
                        <div className="flex items-center gap-3">
                          {drafts[activeReview.id] && <span className="bs-tag bs-green">임시 저장본 있음</span>}
                          <button onClick={() => setIsEditingContent(true)} className={LINK_BTN}>
                            {drafts[activeReview.id] ? '이어서 쓰기' : '수정하기'}
                          </button>
                        </div>
                      )}
                    </div>
                    <ReviewBody review={activeReview} />
                  </section>
                ) : isOwner && drafts[activeReview.id] ? (
                  <section className="bs-book-detail-section space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <h3 className="text-xl font-black tracking-tight">독후감</h3>
                      <span className="bs-tag bs-green">임시 저장</span>
                    </div>
                    <p className="text-sm text-[#666b73]">
                      아직 발행하지 않은 글이 임시 저장되어 있어요. 나만 볼 수 있어요.
                    </p>
                    <button onClick={() => setIsEditingContent(true)} className={BTN}>
                      이어서 쓰기
                    </button>
                  </section>
                ) : null}
              </div>

              {hasSidebar && (
                <aside className="bs-book-community-panel border-t border-[#d5d7da] p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-black tracking-tight">
                      같은 책을 읽은 사람{' '}
                      <span className="text-sm font-semibold text-[#666b73]">({readers.length})</span>
                    </h3>
                    <ToggleButton pressed={showOthers} onClick={() => setShowOthers(!showOthers)}>
                      함께 보기
                    </ToggleButton>
                  </div>

                  {showOthers &&
                    readers.map((o) => (
                      <div key={o.id} className="border-t border-[#d5d7da] pt-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm min-w-0">{renderByline(o.user_id, 22)}</span>
                          <StatusCell review={o} size={14} />
                        </div>

                        {o.quotes && o.quotes.length > 0 && <QuoteList quotes={o.quotes} />}

                        {o.content && (
                          <div className="space-y-1">
                            <p className={LABEL}>독후감</p>
                            <ReviewBody review={o} />
                          </div>
                        )}

                        {(!o.quotes || o.quotes.length === 0) && !o.content && (
                          <p className="text-xs text-[#666b73]">아직 남긴 기록이 없어요.</p>
                        )}
                      </div>
                    ))}
                </aside>
              )}
            </div>

            <div className="flex justify-between items-center gap-3 p-4 border-t border-[#d5d7da]">
              {isOwner ? (
                <button onClick={() => handleDeleteReview(activeReview.id)} className={DANGER_BTN}>
                  이 책 서재에서 삭제
                </button>
              ) : (
                <span />
              )}
              <button onClick={goBack} className={BTN_OUTLINE}>
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

    const sideBtn = `flex w-full items-center gap-2 min-h-[34px] px-3 border border-[#d5d7da] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-[#34373d] hover:text-[#fafafa] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
    const barBtn = `flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-0 border border-[#d5d7da] text-[11px] font-semibold transition-all duration-200 active:bg-[#34373d] active:text-[#fafafa] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;

    const noteForm = (variant: 'side' | 'bar') =>
      selection && notePanelOpen ? (
        <form
          onSubmit={handleAddNote}
          className={
            variant === 'side'
              ? 'space-y-2 border-t border-[#d5d7da] pt-3'
              : 'px-3 py-3 space-y-2 border-b border-[#d5d7da]'
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
              className={`${BTN_OUTLINE} !min-h-[28px] !px-3 flex-1`}
            >
              취소
            </button>
          </div>
        </form>
      ) : null;

    return (
      <div className="bs-main bs-scrap-detail-page">
        <GlobalStyle />
        {header}
        <main className="mx-auto max-w-3xl lg:max-w-[66rem] px-4 py-6 md:py-8 pb-56 lg:pb-8">
          <button
            onClick={goBack}
            className={`${LINK_BTN} min-h-[34px]`}
          >
            &larr; 스크랩북으로 돌아가기
          </button>

          <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
            <article className="scrap-detail-article min-w-0 border border-[#d5d7da] bg-[#fafafa]">
              <section className="scrap-detail-header p-5 md:p-8 border-b border-[#d5d7da] space-y-3">
                <p className="text-[11px] uppercase tracking-widest text-[#666b73]">Clipping</p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight break-words">
                  {activeClip.title}
                </h2>
                <p className="text-xs text-[#666b73] flex flex-wrap gap-x-3 gap-y-1">
                  {activeClip.source &&
                    (isUrl ? (
                      <a
                        href={activeClip.source}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline decoration-2 decoration-[#26292e] underline-offset-4 break-all"
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
                    <button onClick={handleClearHighlights} className={`${DANGER_BTN} min-h-[28px]`}>
                      형광펜 전체 지우기
                    </button>
                  )}
                  <button onClick={handleDeleteClipping} className={`${DANGER_BTN} min-h-[28px]`}>
                    스크랩 삭제
                  </button>
                </div>
              </section>

              <section className="scrap-detail-content p-5 md:p-8">
                <ClipArticle
                  content={activeClip.content}
                  highlights={activeClip.clip_highlights}
                  notes={activeClip.clip_notes}
                  containerRef={articleRef}
                />
              </section>

              {activeClip.clip_highlights.length > 0 && (
                <section className="scrap-detail-content bs-highlight-records p-5 md:p-8 border-t border-[#d5d7da]">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">
                      형광펜 <span className="text-xs font-normal text-[#777777]">({activeClip.clip_highlights.length})</span>
                    </h3>
                    <button type="button" onClick={handleClearHighlights} className="bs-delete-x" aria-label="형광펜 전체 삭제" title="형광펜 전체 삭제">
                      ×
                    </button>
                  </div>
                  <div className="mt-3 divide-y divide-[#e5e5e5]">
                    {[...activeClip.clip_highlights].sort(byCreated).map((h) => {
                      const excerpt = activeClip.content.slice(h.start_offset, h.end_offset).trim() || '선택한 문장';
                      const markerColor = h.color === 'red' ? '#d9364f' : h.color === 'blue' ? '#2d7deb' : '#999999';
                      return (
                        <div key={h.id} className="bs-highlight-record flex items-start gap-3 py-3">
                          <span className="bs-highlight-color shrink-0 mt-1" style={{ backgroundColor: markerColor }} aria-hidden="true" />
                          <p className="min-w-0 flex-1 text-sm leading-relaxed break-words">{excerpt}</p>
                          <button
                            type="button"
                            onClick={() => handleDeleteHighlight(h.id)}
                            className="bs-delete-x shrink-0"
                            aria-label={`형광펜 삭제: ${excerpt.slice(0, 40)}`}
                            title="이 형광펜 삭제"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {notes.length > 0 && (
                <section className="scrap-detail-content p-5 md:p-8 border-t border-[#d5d7da]">
                  <h3 className="text-xl font-black tracking-tight">
                    각주{' '}
                    <span className="text-sm font-semibold text-[#666b73]">({notes.length})</span>
                  </h3>
                  <div className="mt-4 divide-y divide-[#e4e6e9]">
                    {notes.map((n, i) => (
                      <div key={n.id} id={`note-${n.id}`} className="py-4 first:pt-0">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0 text-base font-bold italic leading-relaxed whitespace-pre-line break-words">
                            <span className="not-italic mr-1.5 text-xs font-black">{i + 1})</span>
                            &quot;{n.quote_text}&quot;
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(n.id)}
                            className="bs-delete-x shrink-0"
                            aria-label="각주 삭제"
                            title="각주 삭제"
                          >
                            ×
                          </button>
                        </div>
                        <div className="mt-2 ml-2 flex items-start gap-1.5 text-sm text-[#555a62]">
                          <ReplyIcon />
                          <DiscordText text={n.content} className="flex-1 min-w-0 leading-relaxed" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </article>

            <aside className="hidden lg:block lg:self-start lg:sticky lg:top-6">
              <div className="border border-[#d5d7da] bg-[#fafafa]">
                <div className="px-4 py-2 bg-[#34373d] text-[#fafafa] text-[11px] font-semibold uppercase tracking-widest">
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
                            className="inline-block w-4 h-4 border border-[#d5d7da]"
                            style={{ background: b.color }}
                          />
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#d5d7da] pt-4 space-y-3">
                    <p className={LABEL}>선택한 문장</p>
                    <p className="text-xs text-[#555a62] break-words max-h-32 overflow-y-auto">
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

        <div className="lg:hidden fixed bottom-0 left-0 right-0 min-[621px]:left-[206px] z-40 bg-[#fafafa] border-t border-[#d5d7da] pb-[env(safe-area-inset-bottom)]">
          {noteForm('bar')}
          <div className="px-3 pt-2 flex items-center gap-3 text-xs">
            <span className="flex-1 min-w-0 truncate text-[#666b73]">
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
                <span className="inline-block w-4 h-4 border border-[#d5d7da]" style={{ background: b.color }} />
                <span>{b.label}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={!selection}
              onMouseDown={keepSelection}
              onClick={() => setNotePanelOpen(true)}
              className={`${barBtn} bg-[#34373d] text-[#fafafa]`}
            >
              <span className="text-base font-black leading-none">+</span>
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
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <main className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="border border-[#d5d7da] bg-[#fafafa] grid grid-cols-1 lg:grid-cols-12">
            <section className="lg:col-span-5 p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-[#d5d7da] space-y-6">
              <div className="border-b border-[#d5d7da] pb-2">
                <p className="text-[11px] uppercase tracking-widest text-[#666b73]">Profile</p>
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
                <p className="mt-1 text-xs text-[#666b73]">
                  {Array.from(draft.nickname).length}/16 &middot; 다른 사람과 겹치면 쓸 수 없어요.
                </p>
              </div>

              <div>
                <label className={LABEL}>인장 사진 (선택)</label>
                <div className="mt-2 flex items-center gap-4">
                  <Seal
                    text={previewSeal}
                    color={draft.sealColor}
                    styleType={draft.sealStyle}
                    image={draft.sealImage}
                    size={64}
                    onImageError={() => setSealImageBroken(true)}
                  />
                  <div className="flex flex-wrap gap-2 min-w-0">
                    <label
                      className={`${BTN_OUTLINE} cursor-pointer focus-within:ring-2 focus-within:ring-neutral-950 focus-within:ring-offset-2`}
                    >
                      {draft.sealImage ? '사진 바꾸기' : '사진 올리기'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePickSealImage}
                        className="sr-only"
                      />
                    </label>
                    {draft.sealImage && (
                      <button type="button" onClick={handleRemoveSealImage} className={DANGER_BTN}>
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
                  <p className="mt-2 text-xs font-semibold text-[#26292e] break-words">
                    저장된 사진을 불러오지 못했어요. Supabase Storage의 seals 버킷이 Public(공개)인지 확인해 주세요.
                  </p>
                )}
                {draft.sealImage.startsWith('http') && (
                  <a
                    href={draft.sealImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${LINK_BTN} mt-2 inline-block break-all`}
                  >
                    저장된 사진 주소 열어보기
                  </a>
                )}
                <p className="mt-2 text-xs text-[#666b73]">
                  사진을 고르면 드래그하고 확대해서 보여줄 부분을 정할 수 있어요. 사진은 원래 색 그대로, 기울어진
                  도장 모양으로 보여요. 사진을 쓰면 인장 글자와 모양은 쓰이지 않고, 색은 테두리에만 쓰여요. 저장해야
                  올라가요.
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
                <p className="mt-1 text-xs text-[#666b73]">1~2글자까지 새길 수 있어요.</p>
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
                      className={`inline-flex items-center gap-2 min-h-[34px] px-4 border border-[#d5d7da] text-xs font-semibold tracking-widest transition-colors duration-200 ${FOCUS} ${
                        draft.sealColor === key ? 'bg-[#34373d] text-[#fafafa]' : 'hover:bg-[#e9ebee]'
                      }`}
                    >
                      <span
                        className="inline-block w-4 h-4 border border-[#969ba2]"
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

              <div className="flex items-center gap-4 pt-2 border-t border-[#d5d7da]">
                <button onClick={handleSaveProfile} disabled={profileSaving} className={`${BTN} mt-4`}>
                  {profileSaving ? '저장 중...' : '저장'}
                </button>
                {profileMsg && <span className="mt-4 text-xs font-semibold">{profileMsg}</span>}
                <button onClick={handleLogout} className={`${BTN_OUTLINE} mt-4 ml-auto`}>
                  로그아웃
                </button>
              </div>
            </section>

            <section className="lg:col-span-7">
              <div className="px-5 py-4 border-b border-[#d5d7da]">
                <p className="text-[11px] uppercase tracking-widest text-[#666b73]">Preview</p>
                <h2 className="text-3xl font-black tracking-tight">미리보기</h2>
              </div>

              <div className="p-5 md:p-6 space-y-6">
                <div className="flex items-center gap-5">
                  <Seal
                    text={previewSeal}
                    color={draft.sealColor}
                    styleType={draft.sealStyle}
                    image={draft.sealImage}
                    size={88}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-widest text-[#666b73]">Reader</p>
                    <p className="text-3xl font-black tracking-tight truncate">{previewNick}</p>
                  </div>
                </div>

                <div className="border-t border-[#d5d7da] pt-4 space-y-2">
                  <p className={LABEL}>이렇게 보여요</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Seal
                        text={previewSeal}
                        color={draft.sealColor}
                        styleType={draft.sealStyle}
                        image={draft.sealImage}
                        size={18}
                      />
                      {previewNick}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#666b73]">
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
                  <p className="text-xs text-[#666b73]">
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
    <article key={r.id} className="bs-record-row" onClick={() => openReview(r)}>
      <BookCover title={r.books.title} author={r.books.author} src={r.books.cover_url} width={58} />
      <div className="min-w-0">
        <div className="bs-record-title">{r.books.title}</div>
        <div className="bs-record-excerpt">{excerptOf(r.content)}</div>
        <div className="bs-record-meta">
          {renderByline(r.user_id, 16)}
          <i className="bs-meta-dot" />
          <span>{fmtMD(r.created_at)}</span>
          {r.status === 'completed' && r.rating > 0 && (
            <>
              <i className="bs-meta-dot" />
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
      <div className="bs-main bs-community-shelf-page">
        <GlobalStyle />
        {header}
        <div className="bs-content">
          <div className="bs-page-head">
            <div className="bs-heading-copy">
              <h1 className="bs-h1">서고</h1>
            </div>
            <button className="bs-btn bs-btn-primary bs-record-cta" onClick={goWrite} aria-label="기록 남기기">
              <span aria-hidden="true">＋</span><span>기록 남기기</span>
            </button>
          </div>
          {boardSearch}

          <div className="bs-shelf-toolbar">
            <div className="bs-filter-group">
              {filters.map(([key, label, n]) => (
                <button
                  key={key}
                  className={`bs-filter-btn${filterKey === key ? ' bs-active' : ''}`}
                  onClick={() => setShelfFilter(key)}
                >
                  {label} <span>{n}</span>
                </button>
              ))}
            </div>
            <div className="bs-shelf-count">{visible.length}권의 책</div>
          </div>

          <div className="bs-books-grid">
            {visible.length === 0 ? (
              <div className="bs-empty-state">
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
                  <article key={e.type === 'series' ? e.key : e.isbn} className="bs-book-card" onClick={() => openBook(e)}>
                    <div className="bs-book-card-main">
                      <div className="bs-book-card-cover">
                        <BookCover title={title} author={author} src={cover} width={82} />
                      </div>
                      <div className="bs-book-card-info">
                        <h3 className="bs-h3 bs-book-title">{title}</h3>
                        <div className="bs-book-author">{author}</div>
                        {ratedReviews.length > 0 && (
                          <div className="bs-book-rating" aria-label={`평점 ${averageRating.toFixed(1)}점`}>
                            <span className="bs-rating-stars" aria-hidden="true">
                              {Array.from({ length: 5 }, (_, i) => (
                                <span key={i}>{i < Math.round(averageRating) ? '★' : '☆'}</span>
                              ))}
                            </span>
                            <span className="bs-rating-meta">
                              {averageRating.toFixed(1)} · {ratedReviews.length}명
                            </span>
                          </div>
                        )}
                        {latestQuote && (
                          <p className="bs-book-card-quote">
                            “{plainText(latestQuote.quote.content)}”
                          </p>
                        )}
                        {readingUsers.length > 0 && (
                          <div className="bs-book-readers bs-book-card-readers" aria-label="현재 읽는 사람">
                            {readingUsers.map((uid) => (
                              <span key={uid} className="bs-book-reader" title={nameOf(uid)}>
                                <Seal
                                  text={profileOf(uid).seal_text}
                                  color={profileOf(uid).seal_color}
                                  styleType={profileOf(uid).seal_style}
                                  image={profileOf(uid).seal_image}
                                  size={22}
                                />
                                <span className="bs-reader-name">{nameOf(uid)}</span>
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
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <div className="bs-content">
          <div className="bs-page-head">
            <div className="bs-heading-copy">
              <div className="bs-eyebrow">INDEX OF REFLECTIONS</div>
              <h1 className="bs-h1">독후감 기록</h1>
              <p className="bs-lead">
                책을 읽은 뒤 남겨 둔 생각들의 색인입니다.
                <br />
                책 이름이나 저자로 오래전에 적어 둔 문장을 찾아보세요.
              </p>
            </div>
            <button className="bs-btn bs-btn-primary" onClick={goWrite}>
              ✎ &nbsp; 독후감 쓰기
            </button>
          </div>
          <div className="bs-shelf-toolbar">
            <div className="bs-filter-group">
              <span className="bs-tag">전체 기록 {pad2(writtenAll.length)}</span>
              <span style={{ fontSize: 11, color: '#828282', marginLeft: 7 }}>최신 기록부터 정리합니다.</span>
            </div>
          </div>
          <div className="bs-records">
            {list.length === 0 ? (
              <div className="bs-empty-state">
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
      <div className="bs-main bs-scrapbook-page">
        <GlobalStyle />
        {header}
        <div className="bs-content">
          <div className="bs-page-head">
            <div className="bs-heading-copy">
              <h1 className="bs-h1">스크랩북</h1>
            </div>
            <button
              type="button"
              className="bs-btn bs-btn-primary bs-add-scrap"
              onClick={() => setClipModalOpen(true)}
            >
              <span aria-hidden="true">＋</span><span>스크랩 추가</span>
            </button>
          </div>

          <div className="bs-scrapbook-toolbar">
            <div className="bs-search-wrap bs-main-search">
              <span className="bs-search-icon" aria-hidden="true">⌕</span>
              <input
                className="bs-search"
                type="search"
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
                placeholder="스크랩 제목 또는 출처 검색"
                aria-label="스크랩 제목 또는 출처 검색"
              />
              {boardFilter && (
                <button
                  type="button"
                  className="bs-search-clear"
                  onClick={() => setBoardFilter('')}
                  aria-label="검색어 지우기"
                >×</button>
              )}
            </div>
            <div className="bs-scrapbook-count">
              <strong>{clipList.length}</strong> / {clippings.length}개
            </div>
          </div>

          <div className="bs-scrapbook-list">
            {clipList.length === 0 ? (
              <div className="bs-empty-state">
                <strong>{clippings.length === 0 ? '아직 스크랩이 없어요.' : '찾는 스크랩이 없어요.'}</strong>
                <span>{clippings.length === 0 ? '기사나 칼럼을 추가해 나만의 스크랩북을 만들어 보세요.' : '검색어를 바꿔 보세요.'}</span>
              </div>
            ) : (
              clipList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="bs-scrapbook-card"
                  onClick={() => openClip(c.id)}
                >
                  <div className="bs-scrapbook-card-main">
                    <p className="bs-scrapbook-label">CLIPPING</p>
                    <h2 className="bs-scrapbook-title">{c.title}</h2>
                    <p className="bs-scrapbook-source">
                      {c.source && <><span>{c.source}</span><i>·</i></>}
                      <span>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                    </p>
                    <p className="bs-scrapbook-excerpt">{excerptOf(c.content, 150)}</p>
                    <div className="bs-scrapbook-meta">
                      <span>형광펜 {c.clip_highlights.filter((h) => h.color !== 'erase').length}</span>
                      <span>각주 {c.clip_notes.length}</span>
                    </div>
                  </div>
                  <span className="bs-scrapbook-arrow" aria-hidden="true">↗</span>
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
            className="bs-modal-backdrop"
          >
            <div onClick={(e) => e.stopPropagation()} className="bs-modal-panel">
              <div className="bs-modal-head">
                <div>
                  <p className="bs-modal-eyebrow">NEW CLIPPING</p>
                  <h2 id="new-clipping-title">스크랩 추가</h2>
                </div>
                <button type="button" onClick={() => setClipModalOpen(false)} className={LINK_BTN}>
                  닫기
                </button>
              </div>

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
                    <p className="mt-1 text-xs font-semibold text-[#26292e] break-words">{clipFetchError}</p>
                  )}
                  <p className="mt-1 text-xs text-[#666b73]">
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
                  <p className="mt-1 text-xs text-[#666b73]">
                    저장한 뒤에는 본문을 고칠 수 없어요. 형광펜과 각주 위치가 어긋나기 때문이에요. 불필요한 부분은 저장 전에 지워 주세요.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setClipModalOpen(false)} className={`${BTN_OUTLINE} flex-1`}>
                    취소
                  </button>
                  <button type="submit" disabled={clipSaving} className={`${BTN} flex-1`}>
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
    <div className="bs-main bs-bookshelf-page">
      <GlobalStyle />
      {header}
      <div className="bs-content">
        <div className="bs-page-head">
          <div className="bs-heading-copy">
            <h1 className="bs-h1">책장</h1>
          </div>
          <button type="button" className="bs-btn bs-btn-primary bs-book-add-button" onClick={() => setBookModalOpen(true)}>
            <span aria-hidden="true">＋</span><span>책 추가</span>
          </button>
        </div>
        {boardSearch}

        <div className="bs-shelf-toolbar">
          <div className="bs-filter-group">
            {personalFilters.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`bs-filter-btn${personalShelfFilter === key ? ' bs-active' : ''}`}
                onClick={() => setPersonalShelfFilter(key)}
              >
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
          <div className="bs-shelf-count">{myBooks.length}권</div>
        </div>

        <div className="bs-personal-book-list">
          {myBooks.length === 0 ? (
            <div className="bs-empty-state">
              <strong>{myReviews.length === 0 ? '책장에 아직 책이 없어요.' : '찾는 책이 없어요.'}</strong>
              <span>{myReviews.length === 0 ? '책 추가를 눌러 첫 책을 등록해 보세요.' : '검색어나 분류를 바꿔 보세요.'}</span>
            </div>
          ) : (
            myBooks.map((r) => (
              <button key={r.id} type="button" className="bs-personal-book-card" onClick={() => openReview(r)}>
                <div className="bs-personal-book-cover">
                  <BookCover title={r.books.title} author={r.books.author} src={r.books.cover_url} width={88} />
                </div>
                <div className="bs-personal-book-info">
                  <h2 className="bs-personal-book-title">{r.books.title}</h2>
                  <p className="bs-personal-book-author">{r.books.author}</p>
                  <div className="bs-personal-book-meta">
                    <span className={`bs-personal-status bs-status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    {r.status === 'completed' && r.rating > 0 && (
                      <span className="bs-personal-rating">
                        <RatingDisplay value={r.rating} size={13} />
                        <strong>{r.rating.toFixed(1)}</strong>
                      </span>
                    )}
                  </div>
                  <span className="bs-personal-book-date">등록 {new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <span className="bs-personal-book-arrow" aria-hidden="true">↗</span>
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
          className="bs-modal-backdrop"
        >
          <div onClick={(e) => e.stopPropagation()} className="bs-modal-panel">
            <div className="bs-modal-head">
              <div>
                <p className="bs-modal-eyebrow">NEW BOOK</p>
                <h2 id="new-book-title">책 추가</h2>
              </div>
              <button type="button" onClick={closeBookModal} className={LINK_BTN}>닫기</button>
            </div>

            <form onSubmit={handleSearch} className="bs-book-search-form">
              <label className={LABEL}>책 제목 또는 저자</label>
              <div className="flex gap-2 items-end">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="책 제목 또는 저자 검색..."
                  className={`${INPUT} flex-1`}
                  autoFocus
                />
                <button type="submit" disabled={searchLoading} className={`${BTN} shrink-0`}>
                  {searchLoading ? '검색 중' : '검색'}
                </button>
              </div>
            </form>

            {searchResults.length > 0 && !selectedBook && (
              <div className="bs-book-search-results">
                <div className="flex items-center justify-between gap-3">
                  <span className={LABEL}>검색 결과 {searchResults.length}건</span>
                  <button type="button" onClick={clearSearch} className={DANGER_BTN}>결과 지우기</button>
                </div>
                {searchResults.map((book, idx) => (
                  <div key={`${book.isbn}-${idx}`} className="bs-book-search-result">
                    <img src={book.thumbnail || undefined} alt={book.title} />
                    <div className="min-w-0">
                      <p className="font-bold text-sm break-words">{book.title}</p>
                      <p className="text-xs text-[#666b73]">{book.authors.join(', ')}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedBook(book)} className={`${BTN_OUTLINE} !min-h-[34px] !px-3 shrink-0`}>
                      선택
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedBook && (
              <div className="bs-selected-book">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={selectedBook.thumbnail || undefined} alt={selectedBook.title} />
                    <div className="min-w-0">
                      <p className="font-bold text-sm break-words">{selectedBook.title}</p>
                      <p className="text-xs text-[#666b73]">{selectedBook.authors.join(', ')}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedBook(null)} className={DANGER_BTN}>다시 선택</button>
                </div>

                <form onSubmit={handleSubmitReview} className="space-y-5 mt-5">
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
                      <div className="mt-2"><RatingInput value={rating} onChange={setRating} size={26} /></div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button type="button" onClick={closeBookModal} className={`${BTN_OUTLINE} flex-1`}>취소</button>
                    <button type="submit" className={`${BTN} flex-1`}>
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
