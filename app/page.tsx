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

type Tab = 'home' | 'shelf' | 'reviews' | 'quotes' | 'mine' | 'profile';

interface NavState {
  tab: Tab;
  activeId: string | null;
  activeSeries: string | null;
  activeClipId: string | null;
}
const NAV_HOME: NavState = {
  tab: 'home',
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
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8d4d38] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4efe5]';

const BTN = `inline-flex items-center justify-center min-h-[34px] px-3 sm:px-4 rounded-[3px] border border-[#4c4939] bg-[#4c4939] text-[#fbf7ee] text-xs transition-colors duration-200 hover:bg-[#373528] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
const BTN_OUTLINE = `inline-flex items-center justify-center min-h-[34px] px-3 sm:px-4 rounded-[3px] border border-[#b7a78e] bg-transparent text-[#332e27] text-xs transition-colors duration-200 hover:bg-[#ece2d1] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
const BTN_SM = `inline-flex items-center justify-center min-h-[28px] px-3 rounded-[3px] border border-[#4c4939] bg-[#4c4939] text-[#fbf7ee] text-xs transition-colors duration-200 hover:bg-[#373528] ${FOCUS}`;
const BTN_ACTIVE = `inline-flex items-center justify-center min-h-[34px] px-3 sm:px-4 rounded-[3px] border border-[#4c4939] bg-[#4c4939] text-[#fbf7ee] text-xs ${FOCUS}`;
const LINK_BTN = `text-xs text-[#8d4d38] underline-offset-4 hover:underline ${FOCUS}`;
const DANGER_BTN = `text-xs text-[#9f9382] underline-offset-4 hover:text-[#8d4d38] hover:underline ${FOCUS}`;
const INPUT = `w-full min-w-0 bg-[#f8f3e9] border border-[#d9cdbb] rounded-[2px] px-3 py-2 text-sm text-[#332e27] placeholder:text-[#a79b88] focus:border-[#8d4d38] focus:outline-none`;
const TEXTAREA_BOX = `w-full bg-[#f8f3e9] border border-[#d9cdbb] rounded-[2px] p-3 text-sm leading-relaxed text-[#332e27] placeholder:text-[#a79b88] focus:border-[#8d4d38] focus:outline-none`;
const LABEL = 'block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#71675a]';

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
      @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap');
      :root {
        --paper: #f4efe5; --paper-light: #fbf8f1; --paper-deep: #e9dfce;
        --ink: #332e27; --ink-soft: #71675a; --ink-faint: #9f9382;
        --line: #d9cdbb; --line-dark: #b7a78e; --rust: #8d4d38; --rust-light: #ead8cd;
        --olive: #666b4c; --olive-light: #e4e4d4; --blue: #586778; --blue-light: #dce3e7;
        --shadow: 0 12px 35px rgba(61,47,31,.07);
        --sans: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
        --serif: 'Nanum Myeongjo', 'Batang', '바탕', 'AppleMyungjo', Georgia, serif;
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
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Pretendard', monospace !important;
      }
      ::selection { background: var(--ink); color: var(--paper-light); }
      button { cursor: pointer; }
      .bs-sidebar{position:fixed;inset:0 auto 0 0;width:244px;background:#eae1d2;border-right:1px solid var(--line);padding:27px 18px 20px;display:flex;flex-direction:column;z-index:5}
      .bs-brand{display:flex;align-items:center;gap:11px;padding:0 10px 27px;border-bottom:1px solid var(--line)}
      .bs-brand-mark{width:39px;height:43px;border:1px solid #9e8b70;display:grid;place-items:center;background:var(--paper-light);color:var(--rust);font-family:var(--serif);font-size:20px;position:relative;box-shadow:3px 3px 0 #d5c7b2}
      .bs-brand-mark:before{content:"";position:absolute;left:5px;top:0;bottom:0;border-left:1px solid #d4c5ae}
      .bs-brand-title{font-family:var(--serif);font-size:20px;letter-spacing:-.07em;font-weight:700;line-height:1.2}
      .bs-brand-sub{font-family:var(--serif);font-size:9px;letter-spacing:.17em;color:var(--ink-soft);margin-top:5px}
      .bs-side-label{font-size:10px;letter-spacing:.12em;color:#91836f;margin:26px 11px 9px;text-transform:uppercase}
      .bs-nav{display:grid;gap:5px}
      .bs-nav button{background:transparent;border:0;text-align:left;display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:4px;color:#62594d;transition:.2s}
      .bs-nav button:hover{background:rgba(255,255,255,.42)}
      .bs-nav button.bs-active{background:#d9ccb8;color:#352d24;font-weight:700;box-shadow:inset 3px 0 var(--rust)}
      .bs-nav-ico{width:20px;text-align:center;font-size:16px;color:#89775f}
      .bs-nav-count{margin-left:auto;font-family:var(--serif);font-size:12px;color:#8c7b63}
      .bs-side-spacer{flex:1;min-height:24px}
      .bs-shelf-note{background:#f4ebd7;border:1px solid #ddcda9;padding:15px 15px 14px;transform:rotate(-.5deg);box-shadow:2px 4px 9px rgba(70,52,29,.05);position:relative}
      .bs-shelf-note:before{content:"";position:absolute;width:43px;height:11px;top:-5px;left:calc(50% - 21px);background:#c8b69a;opacity:.7;transform:rotate(2deg)}
      .bs-note-eyebrow{font-size:9px;letter-spacing:.15em;color:#8d6b4e;margin-bottom:7px}
      .bs-shelf-note p{font-family:var(--serif);font-size:14px;margin:0;line-height:1.8;color:#554534}
      .bs-note-sign{font-family:var(--serif);font-style:italic;text-align:right;color:#947e61;margin-top:8px;font-size:11px}
      .bs-side-bottom{display:flex;align-items:center;gap:9px;padding:20px 8px 0;color:var(--ink-soft);font-size:11px}
      .bs-seal{width:26px;height:26px;border:1px solid #bdad95;border-radius:50%;display:grid;place-items:center;font-family:var(--serif);color:var(--rust);font-size:11px}
      .bs-topbar{height:71px;padding:0 42px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;background:rgba(250,247,239,.62);gap:20px}
      .bs-breadcrumb{font-family:var(--serif);color:var(--ink-soft);font-size:12px;letter-spacing:.03em}
      .bs-breadcrumb span{color:#c1b39d;padding:0 8px}
      .bs-top-actions{display:flex;align-items:center;gap:11px}
      .bs-search-wrap{position:relative}
      .bs-search-wrap .bs-search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#938571;font-size:14px}
      .bs-search{width:221px;background:#f9f5ed;border:1px solid var(--line);height:36px;padding:0 12px 0 34px;color:var(--ink);border-radius:3px;font-size:12px}
      .bs-search::placeholder{color:#a79b88}
      .bs-icon-button{height:36px;width:36px;border:1px solid var(--line);background:var(--paper-light);color:#6d5f4d;border-radius:3px;font-size:16px;position:relative}
      .bs-avatar{width:33px;height:33px;border-radius:50%;background:#b8a38a;color:#fffaf0;display:grid;place-items:center;font-family:var(--serif);font-size:13px;border:2px solid #f7f1e7;box-shadow:0 0 0 1px #c6b59c}
      .bs-content{max-width:1420px;margin:0 auto;padding:35px 42px 60px}
      .bs-eyebrow{font-size:10px;letter-spacing:.17em;color:var(--rust);font-weight:700;margin-bottom:10px;text-transform:uppercase}
      .bs-lead{color:var(--ink-soft);font-size:13px;line-height:1.9;margin:0;max-width:650px}
      .bs-page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:27px}
      .bs-page-head .bs-heading-copy{max-width:720px}
      .bs-head-mark{font-family:var(--serif);font-size:11px;color:#9a8a74;letter-spacing:.12em;border-top:1px solid var(--line-dark);padding-top:9px;min-width:123px;text-align:right}
      .bs-btn{border:1px solid var(--line-dark);background:transparent;color:var(--ink);height:39px;padding:0 15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:3px;font-size:12px;transition:.18s;text-decoration:none;white-space:nowrap}
      .bs-btn:hover{background:#ece2d1}
      .bs-btn-primary{background:#4c4939;border-color:#4c4939;color:#fbf7ee}
      .bs-btn-primary:hover{background:#373528;color:#fffaf0}
      .bs-btn-small{height:31px;padding:0 11px;font-size:11px}
      .bs-link-button{background:transparent;border:0;padding:0;color:var(--rust);font-size:12px}
      .bs-section-head{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:15px}
      .bs-section-title{font-family:var(--serif);font-size:18px;letter-spacing:-.04em;display:flex;align-items:center;gap:10px}
      .bs-section-title small{font-family:var(--sans);font-size:10px;letter-spacing:.11em;color:#9d8e79;font-weight:400}
      .bs-rule{height:1px;background:var(--line);flex:1;margin-left:5px}
      .bs-paper-panel{background:rgba(251,248,241,.72);border:1px solid var(--line);box-shadow:var(--shadow)}
      .bs-home-intro{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:30px;align-items:end;margin-bottom:26px}
      .bs-home-intro h1 em{font-weight:400;color:var(--rust);font-style:normal}
      .bs-intro-buttons{display:flex;gap:8px;margin-top:22px}
      .bs-archive-stamp{justify-self:end;width:148px;height:148px;border:1px solid #c9b8a0;outline:1px solid #c9b8a0;outline-offset:-7px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#8c775c;transform:rotate(7deg);font-family:var(--serif);text-align:center}
      .bs-archive-stamp .bs-stamp-symbol{font-size:31px;line-height:1.2;margin-bottom:7px}
      .bs-archive-stamp strong{font-size:11px;letter-spacing:.1em;font-weight:400}
      .bs-archive-stamp small{font-family:var(--sans);font-size:8px;letter-spacing:.18em;margin-top:4px}
      .bs-stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:34px}
      .bs-stat-card{padding:16px 17px;background:#f8f3e9;border:1px solid var(--line);position:relative;min-height:104px;overflow:hidden}
      .bs-stat-card:after{content:"";position:absolute;width:54px;height:54px;border:1px solid rgba(163,143,113,.18);border-radius:50%;right:-15px;bottom:-16px}
      .bs-stat-label{font-size:11px;color:var(--ink-soft);display:flex;align-items:center;gap:7px}
      .bs-stat-number{font-family:var(--serif);font-size:29px;margin-top:7px;line-height:1.1;letter-spacing:-.05em}
      .bs-stat-note{font-size:10px;color:#9a8c78;margin-top:6px}
      .bs-home-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.85fr);gap:26px;align-items:start}
      .bs-records{border-top:1px solid var(--line)}
      .bs-record-row{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:15px;align-items:center;padding:17px 4px;border-bottom:1px solid var(--line)}
      .bs-record-row:hover .bs-record-title{color:var(--rust)}
      .bs-record-title{font-family:var(--serif);font-size:17px;letter-spacing:-.04em;margin-bottom:4px;transition:color .18s;cursor:pointer}
      .bs-record-excerpt{font-family:var(--serif);font-size:12px;color:#776c5b;line-height:1.8;margin-bottom:8px;max-width:570px}
      .bs-record-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:#958671;font-size:10px}
      .bs-meta-dot{width:3px;height:3px;border-radius:50%;background:#b9a991}
      .bs-tag{display:inline-flex;align-items:center;padding:3px 7px;background:#eee4d4;border:1px solid #e1d4c1;color:#79664e;font-size:10px;border-radius:2px;white-space:nowrap}
      .bs-tag.bs-green{background:#e8e7d9;border-color:#d8d8c6;color:#626449}
      .bs-tag.bs-blue{background:#e2e7e8;border-color:#d3dcdd;color:#586b75}
      .bs-row-action{border:0;background:transparent;color:#9c8a70;font-size:16px;padding:8px}
      .bs-row-action.bs-saved{color:var(--rust)}
      .bs-book-cover{--cover:#6c745d;--cover-light:#aab098;width:58px;height:78px;position:relative;display:flex;align-items:center;justify-content:center;background:var(--cover);box-shadow:2px 3px 0 rgba(62,47,29,.13);border-left:4px solid rgba(20,20,15,.14);overflow:hidden;color:#f3e9d3;text-align:center;flex-shrink:0}
      .bs-book-cover:before{content:"";position:absolute;inset:6px;border:1px solid rgba(242,228,196,.47)}
      .bs-book-cover:after{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:rgba(0,0,0,.13)}
      .bs-cover-inner{position:relative;z-index:1;padding:6px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%}
      .bs-cover-top{font-family:var(--serif);font-size:7px;letter-spacing:.09em;opacity:.85;margin-bottom:5px}
      .bs-cover-title{font-family:var(--serif);font-size:11px;line-height:1.45;writing-mode:vertical-rl;max-height:50px;letter-spacing:.04em}
      .bs-cover-author{font-size:6px;letter-spacing:.06em;margin-top:4px;opacity:.8}
      .bs-cover-rust{--cover:#9a5b43;--cover-light:#d5aa8e}
      .bs-cover-blue{--cover:#586879;--cover-light:#b3c0c4}
      .bs-cover-plum{--cover:#6c4c56;--cover-light:#c3a3a2}
      .bs-cover-ochre{--cover:#b0854f;--cover-light:#ddc39a}
      .bs-cover-cream{--cover:#d8c6a5;--cover-light:#f3e8d1;color:#4c4233}
      .bs-cover-cream:before{border-color:rgba(95,76,48,.4)}
      .bs-right-stack{display:grid;gap:21px}
      .bs-memo-card{background:#eee1c5;border:1px solid #d8c5a3;padding:19px 19px 16px;position:relative;box-shadow:2px 5px 12px rgba(66,50,29,.07);transform:rotate(.35deg)}
      .bs-memo-card:before{content:"";position:absolute;width:49px;height:13px;left:calc(50% - 25px);top:-6px;background:#d0bea0;opacity:.77;transform:rotate(-2deg)}
      .bs-memo-label{font-size:9px;letter-spacing:.15em;color:#9b7854;margin-bottom:11px}
      .bs-memo-card p{font-family:var(--serif);font-size:15px;line-height:1.9;color:#554635;margin:0}
      .bs-memo-foot{margin-top:13px;padding-top:10px;border-top:1px dashed #c8b590;display:flex;justify-content:space-between;font-family:var(--serif);font-style:italic;font-size:11px;color:#92795a}
      .bs-member-list{background:rgba(251,248,241,.5);border:1px solid var(--line);padding:18px}
      .bs-member{display:flex;align-items:center;gap:10px;margin-top:14px}
      .bs-member-avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#d8c7ac;color:#66523d;font-family:var(--serif);border:1px solid #c8b698;font-size:11px;flex-shrink:0}
      .bs-member-avatar.bs-a2{background:#d7dcd0;color:#59614a;border-color:#c3cbb9}
      .bs-member-avatar.bs-a3{background:#e2cfc4;color:#845f4e;border-color:#d5bdb1}
      .bs-member-name{font-size:12px;font-weight:600}
      .bs-member-sub{font-size:10px;color:#9b8c76;margin-top:2px}
      .bs-member-status{margin-left:auto;font-size:10px;color:#8d8a6b}
      .bs-mini-calendar{padding:18px;background:#f8f4ec;border:1px solid var(--line)}
      .bs-calendar-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}
      .bs-calendar-month{font-family:var(--serif);font-size:15px}
      .bs-calendar-week,.bs-calendar-days{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;gap:4px}
      .bs-calendar-week{font-size:9px;color:#a09583;margin-bottom:7px}
      .bs-calendar-day{height:26px;display:grid;place-items:center;font-size:10px;color:#756a59;position:relative}
      .bs-calendar-day.bs-marked:after{content:"";width:4px;height:4px;border-radius:50%;background:var(--rust);position:absolute;bottom:1px}
      .bs-calendar-day.bs-today{background:#e5d8c5;border-radius:50%;color:#5a4939;font-weight:700}
      .bs-calendar-day.bs-muted{color:#c6bcac}
      .bs-calendar-foot{border-top:1px solid var(--line);padding-top:10px;margin-top:9px;display:flex;align-items:center;gap:7px;font-size:10px;color:#938470}
      .bs-tiny-dot{width:6px;height:6px;border-radius:50%;background:var(--rust)}
      .bs-shelf-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin:28px 0 20px;padding:12px;background:#eee6d8;border:1px solid var(--line)}
      .bs-filter-group{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
      .bs-filter-btn{border:1px solid transparent;background:transparent;color:#817461;padding:7px 10px;font-size:11px;border-radius:2px}
      .bs-filter-btn.bs-active{border-color:#cbb99e;background:#f8f3e9;color:#443b30;font-weight:700}
      .bs-shelf-count{font-size:11px;color:#897d6b;padding-right:5px}
      .bs-books-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .bs-book-card{background:#faf7ef;border:1px solid var(--line);padding:17px 15px 14px;position:relative;min-width:0;transition:transform .18s,box-shadow .18s;cursor:pointer}
      .bs-book-card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
      .bs-book-card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
      .bs-book-ref{font-family:var(--serif);font-size:10px;color:#a09380;letter-spacing:.1em}
      .bs-bookmark-mini{background:none;border:0;color:#a1927b;font-size:16px;padding:0 2px}
      .bs-book-card .bs-book-cover{width:87px;height:118px;margin:0 auto 17px;box-shadow:4px 5px 0 #ded3c1,6px 7px 0 rgba(65,48,28,.04)}
      .bs-book-card .bs-cover-title{font-size:15px;max-height:79px}
      .bs-book-card .bs-cover-top{font-size:8px;margin-bottom:8px}
      .bs-book-card .bs-cover-author{font-size:7px;margin-top:7px}
      .bs-book-card h3{text-align:center;font-size:15px;margin:0 0 5px;line-height:1.5;min-height:23px}
      .bs-book-author{text-align:center;font-size:10px;color:#9a8d7a;margin-bottom:12px}
      .bs-book-divider{border-top:1px dashed #ded3c1;margin:12px 0}
      .bs-book-card-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px;color:#8c7d68}
      .bs-mini-avatars{display:flex;padding-left:2px}
      .bs-mini-avatars .bs-member-avatar{width:22px;height:22px;margin-left:-4px;font-size:8px;border-width:1px}
      .bs-empty-state{padding:50px;text-align:center;color:#92836f;border:1px dashed var(--line-dark);grid-column:1/-1}
      .bs-empty-state strong{display:block;font-family:var(--serif);font-size:20px;color:#6d5d49;margin:10px}
      .bs-back-link{border:0;background:none;padding:0;color:#8e7d65;display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:24px}
      .bs-review-layout{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:34px;align-items:start}
      .bs-review-paper{background:#fbf8f0;border:1px solid #ded2be;box-shadow:0 14px 34px rgba(71,51,30,.07);position:relative;padding:43px clamp(28px,5vw,68px) 40px;overflow:hidden}
      .bs-review-paper:before{content:"";position:absolute;top:0;bottom:0;left:25px;border-left:1px solid #ead4ca}
      .bs-review-paper:after{content:"";position:absolute;top:0;left:0;right:0;height:7px;background:repeating-linear-gradient(90deg,#d9c8ae 0 15px,transparent 15px 25px);opacity:.7}
      .bs-paper-no{position:absolute;top:21px;right:24px;font-family:var(--serif);font-size:10px;color:#a79a84;letter-spacing:.08em}
      .bs-review-bookline{display:flex;align-items:center;gap:10px;font-family:var(--serif);font-size:12px;color:#796d5b;margin-bottom:17px}
      .bs-review-bookline .bs-line{height:1px;background:#d8cbb7;flex:1}
      .bs-review-paper h1{font-size:31px;margin-bottom:14px;max-width:620px}
      .bs-review-byline{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:#958772;font-size:10px;border-bottom:1px solid #e0d5c3;padding-bottom:20px;margin-bottom:25px}
      .bs-review-byline .bs-author-chip{display:flex;align-items:center;gap:7px;color:#665847}
      .bs-review-byline .bs-member-avatar{width:24px;height:24px;font-size:9px}
      .bs-review-body{font-family:var(--serif);font-size:15px;line-height:2.15;color:#4b4439;letter-spacing:-.02em}
      .bs-review-body p{margin:0 0 20px}
      .bs-review-body .bs-dropcap:first-letter{float:left;font-size:46px;line-height:.9;padding:9px 8px 0 0;color:var(--rust)}
      .bs-review-body blockquote{margin:25px 0;padding:16px 21px;border-left:2px solid #a67a5e;background:#f2eadc;color:#74533e;font-size:16px;line-height:1.9}
      .bs-review-body blockquote cite{display:block;font-family:var(--sans);font-style:normal;font-size:10px;color:#a18c74;margin-top:7px}
      .bs-review-tags{display:flex;gap:6px;flex-wrap:wrap;padding-top:16px;border-top:1px solid #e1d5c1;margin-top:26px}
      .bs-review-actions{display:flex;align-items:center;gap:8px;margin-top:19px}
      .bs-review-actions .bs-btn{height:34px}
      .bs-review-side{display:grid;gap:14px}
      .bs-file-card{background:#eee5d7;border:1px solid #d8c8b0;padding:18px}
      .bs-file-label{font-size:9px;color:#9a7957;letter-spacing:.14em;margin-bottom:12px}
      .bs-file-book{display:flex;gap:12px;align-items:center}
      .bs-file-book .bs-book-cover{width:54px;height:74px}
      .bs-file-book .bs-cover-title{font-size:10px}
      .bs-file-book-title{font-family:var(--serif);font-size:14px;line-height:1.6;margin-bottom:4px}
      .bs-file-book-author{font-size:10px;color:#8d7e68}
      .bs-file-detail{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #d8c8b0;margin-top:15px;padding-top:10px;font-size:10px;color:#8a7a63}
      .bs-margin-note{background:#e7e7d8;border:1px solid #d1d2bd;padding:17px 16px;color:#5e634b;transform:rotate(.7deg)}
      .bs-margin-note .bs-note-label{font-size:9px;letter-spacing:.14em;color:#848666;margin-bottom:9px}
      .bs-margin-note p{font-family:var(--serif);font-size:13px;line-height:1.85;margin:0}
      .bs-margin-note small{display:block;text-align:right;margin-top:9px;font-family:var(--serif);font-size:10px;color:#8e9276;font-style:italic}
      .bs-comments-panel{margin-top:27px;border-top:1px solid var(--line);padding-top:22px}
      .bs-comments-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:17px}
      .bs-comment{display:flex;gap:10px;padding:12px 0;border-bottom:1px solid #e5dac8}
      .bs-comment-content{flex:1;min-width:0}
      .bs-comment-meta{display:flex;align-items:center;gap:9px;margin-bottom:5px;font-size:10px;color:#978973}
      .bs-comment-meta strong{font-size:11px;color:#5e5142}
      .bs-comment-text{font-family:var(--serif);font-size:13px;line-height:1.8;color:#5c5245;margin:0}
      .bs-comment-form{display:flex;gap:8px;margin-top:15px}
      .bs-comment-input{flex:1;min-width:0;height:38px;border:1px solid var(--line);background:#f8f3e9;padding:0 12px;font-size:12px;color:var(--ink)}
      .bs-page-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);margin-top:40px;padding-top:17px;color:#a2947d;font-size:10px}
      .bs-page-footer .bs-footer-brand{font-family:var(--serif);letter-spacing:.08em}
      @media(max-width:1200px){.bs-content{padding:30px 28px 50px}.bs-topbar{padding:0 28px}.bs-books-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.bs-home-grid{grid-template-columns:minmax(0,1.3fr) minmax(240px,.8fr);gap:18px}.bs-review-layout{grid-template-columns:minmax(0,1fr) 220px;gap:20px}}
      @media(max-width:900px){.bs-sidebar{width:206px;padding-left:12px;padding-right:12px}.bs-main{margin-left:206px}.bs-topbar{padding:0 20px}.bs-content{padding:25px 20px 45px}.bs-home-intro{grid-template-columns:1fr}.bs-archive-stamp{display:none}.bs-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bs-home-grid{grid-template-columns:1fr}.bs-right-stack{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.bs-right-stack .bs-mini-calendar{grid-column:1/-1}.bs-review-layout{grid-template-columns:1fr}.bs-review-side{grid-template-columns:repeat(2,minmax(0,1fr));grid-row:1}.bs-review-side .bs-file-card{grid-column:span 1}.bs-books-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:620px){.bs-sidebar{width:100%;height:auto;position:sticky;inset:0 0 auto;padding:10px 14px 9px;display:block;border-right:0;border-bottom:1px solid var(--line)}.bs-brand{padding:0 2px 8px;border:0}.bs-brand-mark{width:31px;height:34px;font-size:16px}.bs-brand-title{font-size:17px}.bs-brand-sub{font-size:8px;margin-top:2px}.bs-sidebar .bs-side-label,.bs-sidebar .bs-side-spacer,.bs-sidebar .bs-shelf-note,.bs-sidebar .bs-side-bottom{display:none}.bs-nav{display:flex;gap:4px;overflow:auto;padding-top:7px}.bs-nav button{flex:1;justify-content:center;gap:5px;padding:8px 7px;white-space:nowrap;font-size:11px}.bs-nav-ico{font-size:13px;width:auto}.bs-nav-count{display:none}.bs-main{margin-left:0}.bs-topbar{height:54px;padding:0 14px}.bs-breadcrumb{font-size:11px}.bs-top-actions{gap:6px}.bs-search{width:min(38vw,180px);height:32px}.bs-icon-button{width:32px;height:32px}.bs-content{padding:25px 14px 35px}.bs-page-head{align-items:flex-start;flex-direction:column;margin-bottom:22px;gap:15px}.bs-page-head h1{font-size:29px}.bs-page-head .bs-head-mark{display:none}.bs-home-intro h1{font-size:30px}.bs-lead{font-size:12px}.bs-intro-buttons{margin-top:16px}.bs-stats-grid{gap:8px}.bs-stat-card{padding:13px;min-height:91px}.bs-stat-number{font-size:25px}.bs-record-row{grid-template-columns:48px minmax(0,1fr) auto;gap:10px;padding:14px 0}.bs-record-row .bs-book-cover{width:48px;height:65px}.bs-record-title{font-size:15px}.bs-record-excerpt{font-size:11px;line-height:1.7}.bs-row-action{padding:4px}.bs-right-stack{grid-template-columns:1fr}.bs-right-stack .bs-mini-calendar{grid-column:auto}.bs-books-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.bs-book-card{padding:12px 9px}.bs-book-card .bs-book-cover{width:78px;height:105px}.bs-book-card h3{font-size:13px}.bs-shelf-toolbar{align-items:flex-start}.bs-filter-group{width:100%}.bs-shelf-count{margin-left:auto}.bs-review-paper{padding:36px 23px 30px 31px}.bs-review-paper:before{left:17px}.bs-review-paper h1{font-size:25px}.bs-review-body{font-size:14px;line-height:2}.bs-review-side{grid-template-columns:1fr 1fr;gap:9px}.bs-file-card,.bs-margin-note{padding:13px}.bs-file-book{gap:8px}.bs-file-book .bs-book-cover{width:42px;height:60px}.bs-file-book-title{font-size:12px}.bs-file-book-author{font-size:9px}.bs-comment-form{flex-wrap:wrap}.bs-comment-form .bs-btn{flex:0 0 100%}.bs-page-footer{font-size:9px}.bs-hide-mobile{display:none}}
      .bs-h1,.bs-h2,.bs-h3,.bs-serif{font-family:var(--serif)}
      .bs-h1{font-size:35px;letter-spacing:-.075em;line-height:1.32;font-weight:700;margin:0 0 12px}
      .bs-h2{font-size:23px;letter-spacing:-.055em;margin:0}
      .bs-h3{font-size:17px;letter-spacing:-.04em;margin:0}
      .bs-page-head .bs-h1{margin-bottom:12px}
      @media(max-width:620px){.bs-h1{font-size:29px}}
      .bs-cover-img{object-fit:cover;box-shadow:2px 3px 0 rgba(62,47,29,.13);border-left:4px solid rgba(20,20,15,.14);flex-shrink:0;display:block;background:#e9dfce}
      .bs-footer-wrap{max-width:1420px;margin:0 auto;padding:0 42px 40px}
      @media(max-width:1200px){.bs-footer-wrap{padding:0 28px 40px}}
      @media(max-width:900px){.bs-footer-wrap{padding:0 20px 40px}}
      @media(max-width:620px){.bs-footer-wrap{padding:0 14px 30px}}
      .bs-main{margin-left:244px;min-height:100vh}
      @media(max-width:900px){.bs-main{margin-left:206px}}
      @media(max-width:620px){.bs-main{margin-left:0}}
      .bs-avatar-btn{background:none;border:0;padding:0;display:inline-flex;align-items:center}
      .bs-quote-row{grid-template-columns:34px minmax(0,1fr)}
      .bs-quote-mark{font-family:var(--serif);font-size:42px;line-height:.9;color:#c9b79b}
      .bs-quote-comment{font-size:12px;color:#7a6a55;margin:-2px 0 6px 2px}
      .bs-cover-wrap{display:flex;justify-content:center}
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
        className="absolute inset-0 text-[#e5dac8]"
        fill="currentColor"
      >
        <path d={STAR_PATH} />
      </svg>
      <span
        className="absolute left-0 top-0 h-full overflow-hidden text-[#332e27]"
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
    <span className="inline-block bg-[#8d4d38] px-2 py-0.5 text-[11px] font-semibold tracking-widest text-white">
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
      className="mt-1 shrink-0 text-[#9f9382]"
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
      className={`px-0.5 ${shown ? 'bg-[#e5dac8]' : 'bg-[#4c4939] cursor-pointer select-none'}`}
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
        className="px-1 py-0.5 bg-[#e5dac8] text-[0.85em] font-normal not-italic text-[#332e27]"
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
        className="underline decoration-2 decoration-[#8d4d38] underline-offset-4"
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
        className="underline decoration-2 decoration-[#8d4d38] underline-offset-4 break-all"
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
            className="my-1 p-3 border border-[#d9cdbb] bg-[#e5dac8] text-xs font-normal not-italic text-[#332e27] whitespace-pre overflow-x-auto"
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
        <blockquote key={key()} className="my-1 border-l border-[#d9cdbb] pl-3 text-[#5c5245]">
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
        <blockquote key={key()} className="my-1 border-l border-[#d9cdbb] pl-3 text-[#5c5245]">
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
        <p key={kk} className="text-xs text-[#71675a]">
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
    <div className="divide-y divide-[#e5dac8]">
      {quotes.map((q) => (
        <div key={q.id} className="py-4 first:pt-0">
          <div className="flex justify-between items-start gap-3">
            <div
              onClick={isOwner ? () => toggle(q.id) : undefined}
              className={`min-w-0 text-base font-bold italic leading-relaxed ${
                isOwner ? 'cursor-pointer hover:text-[#8d4d38] transition-colors duration-200' : ''
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
                <div key={c.id} className="flex items-start gap-1.5 text-sm text-[#5c5245]">
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

const SEAL_COLORS: Record<string, { label: string; hex: string }> = {
  ink: { label: '먹색', hex: '#332e27' },
  red: { label: '붉은색', hex: '#CC0000' },
  grey: { label: '회색', hex: '#5c5245' },
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
        className="inline-block shrink-0 overflow-hidden bg-[#e9dfce]"
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
      boxShadow: `inset 0 0 0 ${w}px #fbf8f1, inset 0 0 0 ${w * 2}px ${hex}`,
    };
  } else {
    extra = { color: '#fbf8f1', background: hex, border: `${w}px solid ${hex}` };
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
    <span className="inline-block border border-[#d9cdbb] px-2 py-0.5 text-[11px] font-semibold tracking-widest">
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
  red: 'rgba(204, 0, 0, 0.28)',
  blue: 'rgba(0, 71, 204, 0.28)',
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
          className={noted ? 'underline decoration-[#332e27] decoration-1 underline-offset-4' : undefined}
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
              className="ml-0.5 cursor-pointer text-[11px] font-black hover:text-[#8d4d38]"
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
  ctx.fillStyle = '#fbf8f1';
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
    ctx.fillStyle = '#fbf8f1';
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
  const guide = 'rgba(255,255,255,0.55)';
  const thirds = `linear-gradient(to right, transparent calc(33.33% - 0.5px), ${guide} calc(33.33% - 0.5px), ${guide} calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), ${guide} calc(66.66% - 0.5px), ${guide} calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)), linear-gradient(to bottom, transparent calc(33.33% - 0.5px), ${guide} calc(33.33% - 0.5px), ${guide} calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), ${guide} calc(66.66% - 0.5px), ${guide} calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))`;

  return (
    <div className="mt-3 border border-[#d9cdbb] p-3 space-y-3">
      <p className={LABEL}>사진 자르기</p>

      <div className="flex flex-wrap items-start gap-4">
        <div
          ref={viewRef}
          className="relative shrink-0 overflow-hidden border border-[#d9cdbb] bg-[#e9dfce] cursor-grab active:cursor-grabbing select-none"
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
          <p className="text-xs text-[#71675a]">실제로 이렇게 기울어진 도장으로 보여요.</p>
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
            className="flex-1 min-w-0 accent-[#332e27]"
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

      <p className="text-xs text-[#71675a]">
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

const COVER_COLORS = ['#6c745d', '#9a5b43', '#586879', '#6c4c56', '#b0854f', '#d8c6a5', '#4c6872'];

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
  const light = bg === '#d8c6a5';

  return (
    <div
      className="bs-book-cover"
      style={{ width, height, background: bg, color: light ? '#4c4233' : '#f3e9d3' }}
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

function Footer({ label = 'A PRIVATE READING ARCHIVE' }: { label?: string }) {
  return (
    <div className="bs-footer-wrap">
      <footer className="bs-page-footer">
        <span className="bs-footer-brand">책장 사이 · {label}</span>
        <span>우리의 작은 기록실</span>
      </footer>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [regStatus, setRegStatus] = useState<Status>('completed');
  const [rating, setRating] = useState<number>(0);
  const [searchLoading, setSearchLoading] = useState(false);

  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const [tab, setTab] = useState<Tab>('mine');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [boardFilter, setBoardFilter] = useState('');
  const [showOthers, setShowOthers] = useState(true);
  const [newQuoteInput, setNewQuoteInput] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContentText, setEditContentText] = useState('');
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
    if (!clipModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClipModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clipModalOpen]);

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
    window.history.replaceState({ ...window.history.state, rp: true, idx: 0, nav: NAV_HOME }, '');
    navIdx.current = 0;

    const onPop = (e: PopStateEvent) => {
      const st = e.state as { rp?: boolean; idx?: number; nav?: NavState; scroll?: number } | null;
      if (st?.rp && st.nav) {
        navIdx.current = st.idx ?? 0;
        applyNav(st.nav);
        setTimeout(() => window.scrollTo(0, st.scroll ?? 0), 50);
      } else {
        navIdx.current = 0;
        applyNav(NAV_HOME);
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
    applyNav(NAV_HOME);
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
      setRating(0);
      setRegStatus('completed');
      setSearchResults([]);
      setQuery('');
      await loadData(user);

      navigate({ tab: 'mine', activeId: reviewData.id });
      setEditContentText('');
    } catch (err) {
      alert(`저장 실패: ${errMsg(err)}`);
    }
  };

  const handleUpdateStatus = async (nextStatus: Status, nextRating: number) => {
    if (!activeReview || !isOwner) return;
    const savedRating = nextStatus === 'completed' ? nextRating : 0;

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
    } catch (err) {
      alert(`독후감 저장 실패: ${errMsg(err)}`);
    }
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
    navigate({ activeClipId: id });
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
    setEditContentText(rev.content || '');
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
      <main className="min-h-screen flex items-center justify-center p-4 text-[#332e27]">
        <GlobalStyle />
        <div className="w-full max-w-md border border-[#d9cdbb] bg-[#fbf8f1] p-8">
          <p className="text-center text-[11px] uppercase tracking-widest text-[#71675a] mb-3">
            A PRIVATE READING ARCHIVE
          </p>
          <h1 className="text-center text-5xl font-black tracking-tighter leading-none border-b border-[#d9cdbb] pb-4">
            책장 사이
          </h1>
          <p className="text-center text-sm text-[#5c5245] mt-4 mb-8">
            {isSignUp ? '새로운 계정 생성하기' : '읽고, 남기고, 다시 꺼내 보는 일'}
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

  const mySeal = profileOf(user.id);

  const renderByline = (userId: string, size = 18, className = '') => {
    const p = profileOf(userId);
    return (
      <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
        <Seal text={p.seal_text} color={p.seal_color} styleType={p.seal_style} image={p.seal_image} size={size} />
        <span className="truncate">{p.nickname}</span>
      </span>
    );
  };

  const countBooks = new Set(allReviews.map((r) => r.book_isbn)).size;
  const writtenAll = allReviews.filter((r) => r.content.trim());
  const pad2 = (n: number) => String(n).padStart(2, '0');

  const pageName = activeClip
    ? '스크랩'
    : activeReview
      ? '독후감 상세'
      : ({ home: '홈', shelf: '공동 서재', reviews: '독후감 기록', quotes: '문장 수집장', mine: '나의 기록', profile: '프로필' } as Record<Tab, string>)[tab];

  const navItem = (t: Tab, icon: string, label: string, count?: number) => (
    <button key={t} className={tab === t ? 'bs-active' : ''} onClick={() => goTab(t)}>
      <span className="bs-nav-ico">{icon}</span> {label}
      {count !== undefined && <span className="bs-nav-count">{pad2(count)}</span>}
    </button>
  );

  const header = (
    <>
      <aside className="bs-sidebar">
        <div className="bs-brand">
          <div className="bs-brand-mark">間</div>
          <div>
            <div className="bs-brand-title">책장 사이</div>
            <div className="bs-brand-sub">A PRIVATE READING ARCHIVE</div>
          </div>
        </div>
        <div className="bs-side-label">ARCHIVE MENU</div>
        <nav className="bs-nav" aria-label="주 메뉴">
          {navItem('home', '⌂', '기록실 홈')}
          {navItem('shelf', '▤', '공동 서재', countBooks)}
          {navItem('reviews', '☷', '독후감 기록', writtenAll.length)}
        </nav>
        <div className="bs-side-label">MY DESK</div>
        <nav className="bs-nav" aria-label="개인 메뉴">
          {navItem('quotes', '❞', '문장 수집장')}
          {navItem('mine', '▦', '나의 기록')}
        </nav>
        <div className="bs-side-spacer" />
        <div className="bs-shelf-note">
          <div className="bs-note-eyebrow">TODAY&apos;S NOTE</div>
          <p>
            읽는 일은 혼자지만,
            <br />
            기억은 함께 나눌 수 있으니까.
          </p>
          <div className="bs-note-sign">— 책장 사이에서</div>
        </div>
        <div className="bs-side-bottom">
          <span>함께 읽는 작은 서재</span>
          <button onClick={handleLogout} className="bs-link-button" style={{ marginLeft: 'auto' }}>
            로그아웃
          </button>
        </div>
      </aside>

      <header className="bs-topbar">
        <div className="bs-breadcrumb">
          기록실 <span>/</span> {pageName}
        </div>
        <div className="bs-top-actions">
          <label className="bs-search-wrap" aria-label="아카이브 검색">
            <span className="bs-search-icon">⌕</span>
            <input
              className="bs-search"
              type="search"
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              placeholder="책, 문장, 기록 찾기…"
            />
          </label>
          <button
            className="bs-icon-button"
            title="책 · 스크랩 추가"
            aria-label="책 · 스크랩 추가"
            onClick={() => {
              goTab('mine');
            }}
          >
            ＋
          </button>
          <button
            onClick={() => goTab('profile')}
            title="프로필 편집"
            aria-label="프로필 편집"
            className="bs-avatar-btn"
          >
            <Seal
              text={mySeal.seal_text}
              color={mySeal.seal_color}
              styleType={mySeal.seal_style}
              image={mySeal.seal_image}
              size={32}
            />
          </button>
        </div>
      </header>
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
      'grid grid-cols-12 gap-3 items-center px-5 py-3 border-b border-[#d9cdbb] last:border-b-0 hover:bg-[#ece2d1] cursor-pointer transition-colors duration-200 group';
    const coverClass =
      'w-9 h-12 object-cover border border-[#d9cdbb] bg-[#e9dfce] transition duration-200 shrink-0';
    const titleClass =
      'font-bold text-sm truncate underline-offset-4 decoration-2 decoration-[#8d4d38] group-hover:underline';

    return (
      <>
        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2 bg-[#eee6d8] text-[#71675a] text-[11px] font-semibold uppercase tracking-widest">
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
                      <span className="block text-[11px] text-[#71675a]">
                        시리즈 &middot; 기록된 {row.volumes.length}권
                      </span>
                    </span>
                  </div>
                  <span className={`col-span-6 ${col.author} text-xs text-[#5c5245] truncate`}>
                    {row.author}
                  </span>
                  {showAuthor && (
                    <span className={`col-span-6 ${col.nick} text-xs font-semibold min-w-0 flex items-center gap-1`}>
                      {renderByline(userIds[0], 18)}
                      {userIds.length > 1 && (
                        <span className="shrink-0 text-[#71675a]">외 {userIds.length - 1}명</span>
                      )}
                    </span>
                  )}
                  <div className={`col-span-6 ${col.status} flex sm:justify-center`}>
                    <span className="inline-block bg-[#4c4939] px-2 py-0.5 text-[11px] font-semibold tracking-widest text-[#fbf8f1]">
                      시리즈
                    </span>
                  </div>
                  <span className={`hidden sm:block ${col.date} text-right text-[11px] text-[#71675a]`}>
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
                <span className={`col-span-6 ${col.author} text-xs text-[#5c5245] truncate`}>
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
                <span className={`hidden sm:block ${col.date} text-right text-[11px] text-[#71675a]`}>
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
    const showReview = (isEditingContent && isOwner) || !!activeReview.content;
    const showQuotes = isOwner || hasQuotes;
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
        <main className="max-w-[700px] mx-auto px-4 py-6 md:py-8 space-y-4">
          <button onClick={goBack} className={`${LINK_BTN} min-h-[34px]`}>
            &larr; 목록으로 돌아가기
          </button>

          {seriesEntry && (
            <div className="border border-[#d9cdbb] bg-[#fbf8f1] px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-[#71675a]">Series</p>
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

          <article className="border border-[#d9cdbb] bg-[#fbf8f1]">
            <section className="p-5 md:p-6 border-b border-[#d9cdbb]">
              <div className="flex gap-4 sm:gap-5">
                <img
                  src={activeReview.books.cover_url || undefined}
                  alt={activeReview.books.title}
                  className="w-20 h-28 sm:w-24 sm:h-36 object-cover border border-[#d9cdbb] bg-[#e9dfce] transition duration-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#71675a]">
                        {renderByline(activeReview.user_id, 20, 'font-semibold text-[#332e27]')}
                        <span>&middot; {new Date(activeReview.created_at).toLocaleDateString('ko-KR')}</span>
                      </p>
                      <h2 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight break-words">
                        {activeReview.books.title}
                      </h2>
                      <p className="mt-1 text-sm text-[#5c5245]">{activeReview.books.author}</p>
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

            <div>
              <div>
                {showQuotes && (
                  <section className={`p-5 md:p-6 ${showReview ? 'border-b border-[#d9cdbb]' : ''}`}>
                    <h3 className="text-xl font-black tracking-tight">
                      인용문{' '}
                      <span className="text-sm font-semibold text-[#71675a]">
                        ({activeReview.quotes?.length || 0})
                      </span>
                    </h3>
                    {isOwner && hasQuotes && (
                      <p className="mt-1 text-xs text-[#71675a]">인용문을 누르면 코멘트를 달 수 있어요.</p>
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
                        <p className="text-sm text-[#71675a]">아직 추가된 인용문이 없습니다.</p>
                      )}
                    </div>

                    {isOwner && (
                      <form
                        onSubmit={handleAddQuote}
                        className="mt-5 pt-5 border-t border-[#d9cdbb] flex gap-3 items-end"
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
                    <p className="text-xs text-[#71675a]">
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
                      className="text-sm leading-relaxed text-[#4b4439]"
                    />
                  </section>
                ) : null}
              </div>

              {hasSidebar && (
                <aside className="border-t border-[#d9cdbb] p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-black tracking-tight">
                      같은 책을 읽은 사람{' '}
                      <span className="text-sm font-semibold text-[#71675a]">({readers.length})</span>
                    </h3>
                    <ToggleButton pressed={showOthers} onClick={() => setShowOthers(!showOthers)}>
                      함께 보기
                    </ToggleButton>
                  </div>

                  {showOthers &&
                    readers.map((o) => (
                      <div key={o.id} className="border-t border-[#d9cdbb] pt-4 space-y-3">
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
                              className="text-sm leading-relaxed text-[#4b4439]"
                            />
                          </div>
                        )}

                        {(!o.quotes || o.quotes.length === 0) && !o.content && (
                          <p className="text-xs text-[#71675a]">아직 남긴 기록이 없어요.</p>
                        )}
                      </div>
                    ))}
                </aside>
              )}
            </div>

            <div className="flex justify-between items-center gap-3 p-4 border-t border-[#d9cdbb]">
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
        <Footer />
      </div>
    );
  }

  if (activeClip) {
    const notes = sortNotes(activeClip.clip_notes);
    const isUrl = !!activeClip.source && /^https?:\/\//i.test(activeClip.source);
    const swatches: { key: 'red' | 'blue' | 'erase'; label: string; color: string }[] = [
      { key: 'red', label: '빨간색', color: '#CC0000' },
      { key: 'blue', label: '파란색', color: '#0047CC' },
      { key: 'erase', label: '지우개', color: '#FFFFFF' },
    ];
    const keepSelection = (e: React.MouseEvent) => e.preventDefault();

    const sideBtn = `flex w-full items-center gap-2 min-h-[34px] px-3 border border-[#d9cdbb] text-xs font-semibold tracking-widest transition-all duration-200 hover:bg-[#4c4939] hover:text-[#fbf8f1] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;
    const barBtn = `flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-0 border border-[#d9cdbb] text-[11px] font-semibold transition-all duration-200 active:bg-[#4c4939] active:text-[#fbf8f1] disabled:opacity-40 disabled:pointer-events-none ${FOCUS}`;

    const noteForm = (variant: 'side' | 'bar') =>
      selection && notePanelOpen ? (
        <form
          onSubmit={handleAddNote}
          className={
            variant === 'side'
              ? 'space-y-2 border-t border-[#d9cdbb] pt-3'
              : 'px-3 py-3 space-y-2 border-b border-[#d9cdbb]'
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
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <main className="mx-auto max-w-3xl lg:max-w-[66rem] px-4 py-6 md:py-8 pb-56 lg:pb-8">
          <button
            onClick={goBack}
            className={`${LINK_BTN} min-h-[34px]`}
          >
            &larr; 내 서재로 돌아가기
          </button>

          <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
            <article className="min-w-0 border border-[#d9cdbb] bg-[#fbf8f1]">
              <section className="p-5 md:p-8 border-b border-[#d9cdbb] space-y-3">
                <p className="text-[11px] uppercase tracking-widest text-[#71675a]">Clipping</p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight break-words">
                  {activeClip.title}
                </h2>
                <p className="text-xs text-[#71675a] flex flex-wrap gap-x-3 gap-y-1">
                  {activeClip.source &&
                    (isUrl ? (
                      <a
                        href={activeClip.source}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline decoration-2 decoration-[#8d4d38] underline-offset-4 break-all"
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

              <section className="p-5 md:p-8">
                <ClipArticle
                  content={activeClip.content}
                  highlights={activeClip.clip_highlights}
                  notes={activeClip.clip_notes}
                  containerRef={articleRef}
                />
              </section>

              {notes.length > 0 && (
                <section className="p-5 md:p-8 border-t border-[#d9cdbb]">
                  <h3 className="text-xl font-black tracking-tight">
                    각주{' '}
                    <span className="text-sm font-semibold text-[#71675a]">({notes.length})</span>
                  </h3>
                  <div className="mt-4 divide-y divide-[#e5dac8]">
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
                        <div className="mt-2 ml-2 flex items-start gap-1.5 text-sm text-[#5c5245]">
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
              <div className="border border-[#d9cdbb] bg-[#fbf8f1]">
                <div className="px-4 py-2 bg-[#4c4939] text-[#fbf8f1] text-[11px] font-semibold uppercase tracking-widest">
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
                            className="inline-block w-4 h-4 border border-[#d9cdbb]"
                            style={{ background: b.color }}
                          />
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#d9cdbb] pt-4 space-y-3">
                    <p className={LABEL}>선택한 문장</p>
                    <p className="text-xs text-[#5c5245] break-words max-h-32 overflow-y-auto">
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

        <div className="lg:hidden fixed bottom-0 left-0 right-0 min-[621px]:left-[206px] z-40 bg-[#fbf8f1] border-t border-[#d9cdbb] pb-[env(safe-area-inset-bottom)]">
          {noteForm('bar')}
          <div className="px-3 pt-2 flex items-center gap-3 text-xs">
            <span className="flex-1 min-w-0 truncate text-[#71675a]">
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
                <span className="inline-block w-4 h-4 border border-[#d9cdbb]" style={{ background: b.color }} />
                <span>{b.label}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={!selection}
              onMouseDown={keepSelection}
              onClick={() => setNotePanelOpen(true)}
              className={`${barBtn} bg-[#4c4939] text-[#fbf8f1]`}
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
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <main className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="border border-[#d9cdbb] bg-[#fbf8f1] grid grid-cols-1 lg:grid-cols-12">
            <section className="lg:col-span-5 p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-[#d9cdbb] space-y-6">
              <div className="border-b border-[#d9cdbb] pb-2">
                <p className="text-[11px] uppercase tracking-widest text-[#71675a]">Profile</p>
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
                <p className="mt-1 text-xs text-[#71675a]">
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
                  <p className="mt-2 text-xs font-semibold text-[#8d4d38] break-words">
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
                <p className="mt-2 text-xs text-[#71675a]">
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
                <p className="mt-1 text-xs text-[#71675a]">1~2글자까지 새길 수 있어요.</p>
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
                      className={`inline-flex items-center gap-2 min-h-[34px] px-4 border border-[#d9cdbb] text-xs font-semibold tracking-widest transition-colors duration-200 ${FOCUS} ${
                        draft.sealColor === key ? 'bg-[#4c4939] text-[#fbf8f1]' : 'hover:bg-[#ece2d1]'
                      }`}
                    >
                      <span
                        className="inline-block w-4 h-4 border border-[#9f9382]"
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

              <div className="flex items-center gap-4 pt-2 border-t border-[#d9cdbb]">
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
              <div className="px-5 py-4 border-b border-[#d9cdbb]">
                <p className="text-[11px] uppercase tracking-widest text-[#71675a]">Preview</p>
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
                    <p className="text-[11px] uppercase tracking-widest text-[#71675a]">Reader</p>
                    <p className="text-3xl font-black tracking-tight truncate">{previewNick}</p>
                  </div>
                </div>

                <div className="border-t border-[#d9cdbb] pt-4 space-y-2">
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
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#71675a]">
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
                  <p className="text-xs text-[#71675a]">
                    인장은 전체 서재 목록, 글 상세 화면, 같은 책을 읽은 사람 목록에서 닉네임 옆에 찍혀요.
                  </p>
                </div>

                <div>
                  <p className={LABEL}>나의 기록</p>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 border-t border-l border-[#d9cdbb]">
                    {stats.map(([label, n]) => (
                      <div key={label} className="p-4 border-r border-b border-[#d9cdbb]">
                        <p className="text-3xl font-black tracking-tight">{n}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-widest text-[#71675a]">{label}</p>
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
  };

  if (tab === 'home') {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const recent = writtenAll.filter(matchesFilter).slice(0, 4);
    const allQuotes = allReviews
      .flatMap((r) => (r.quotes || []).map((q) => ({ q, r })))
      .sort((a, b) => b.q.created_at.localeCompare(a.q.created_at));
    const pinned = allQuotes[0];
    const memberIds = Array.from(new Set([user.id, ...Object.keys(profiles)]));
    const lastOf = (uid: string) => {
      const dates = allReviews
        .filter((r) => r.user_id === uid)
        .flatMap((r) => [r.created_at, ...(r.quotes || []).map((q) => q.created_at)]);
      return dates.sort().pop();
    };

    const marked = new Set<number>();
    myReviews
      .flatMap((r) => [r.created_at, ...(r.quotes || []).map((q) => q.created_at)])
      .forEach((iso) => {
        const d = new Date(iso);
        if (d.getFullYear() === y && d.getMonth() === m) marked.add(d.getDate());
      });
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const cells: { label: number; muted: boolean }[] = [];
    for (let i = firstDow - 1; i >= 0; i--) cells.push({ label: prevDays - i, muted: true });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ label: d, muted: false });
    for (let d = 1; cells.length % 7 !== 0; d++) cells.push({ label: d, muted: true });

    const stats: [string, number, string, string][] = [
      ['▤ 함께 모은 책', countBooks, '권', '모두의 책장에서'],
      ['▧ 쌓인 독후감', writtenAll.length, '편', '생각의 기록들'],
      ['❞ 모아둔 문장', allQuotes.length, '개', '다시 읽고 싶은 구절'],
      ['⌁ 함께한 멤버', memberIds.length, '명', '작은 서재 식구'],
    ];

    return (
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <div className="bs-content">
          <div className="bs-home-intro">
            <div>
              <div className="bs-eyebrow">
                PRIVATE ARCHIVE · {now.toLocaleString('en-US', { month: 'long' }).toUpperCase()} {y}
              </div>
              <h1 className="bs-h1">
                읽고, 남기고,
                <br />
                <em>다시 꺼내 보는 일.</em>
              </h1>
              <p className="bs-lead">
                우리가 읽은 책과 오래 마음에 남은 문장들을 모아두는 작은 기록실입니다.
                <br />
                잘 정리된 서가처럼, 생각도 천천히 자리를 찾아가도록.
              </p>
              <div className="bs-intro-buttons">
                <button className="bs-btn bs-btn-primary" onClick={goWrite}>
                  ✎ &nbsp; 독후감 남기기
                </button>
                <button className="bs-btn" onClick={() => goTab('shelf')}>
                  서가 둘러보기 &nbsp; ↗
                </button>
              </div>
            </div>
            <div className="bs-archive-stamp">
              <div className="bs-stamp-symbol">書</div>
              <strong>OUR READING ROOM</strong>
              <small>NO. {pad2(memberIds.length)}</small>
            </div>
          </div>

          <div className="bs-stats-grid">
            {stats.map(([label, n, unit, note]) => (
              <div key={label} className="bs-stat-card">
                <div className="bs-stat-label">{label}</div>
                <div className="bs-stat-number">
                  {pad2(n)}
                  <span style={{ fontSize: 14, marginLeft: 3 }}>{unit}</span>
                </div>
                <div className="bs-stat-note">{note}</div>
              </div>
            ))}
          </div>

          <div className="bs-home-grid">
            <div>
              <div className="bs-section-head">
                <div className="bs-section-title">
                  최근에 남긴 기록 <small>RECENT ENTRIES</small>
                </div>
                <div className="bs-rule" />
                <button className="bs-link-button" onClick={() => goTab('reviews')}>
                  모두 보기 ↗
                </button>
              </div>
              <div className="bs-records">
                {recent.length === 0 ? (
                  <div className="bs-empty-state">
                    <strong>아직 남긴 독후감이 없어요.</strong>
                    <span>책을 고르고 첫 기록을 남겨 보세요.</span>
                  </div>
                ) : (
                  recent.map(renderEntryRow)
                )}
              </div>
            </div>

            <aside className="bs-right-stack">
              <div className="bs-memo-card">
                <div className="bs-memo-label">PINNED MEMO</div>
                <p>
                  {pinned
                    ? `“${plainText(pinned.q.content).slice(0, 90)}${plainText(pinned.q.content).length > 90 ? '…' : ''}”`
                    : '“마음에 남은 문장을 한 줄 적어 두면 여기에 붙여 둘게요.”'}
                </p>
                <div className="bs-memo-foot">
                  <span>{pinned ? pinned.r.books.title : '서가에 붙여 둔 메모'}</span>
                  <span>{pinned ? fmtMD(pinned.q.created_at) : ''}</span>
                </div>
              </div>

              <div className="bs-member-list">
                <div className="bs-section-head" style={{ margin: 0 }}>
                  <div className="bs-section-title" style={{ fontSize: 16 }}>
                    함께 읽는 사람
                  </div>
                  <span className="bs-tag bs-green">{memberIds.length} MEMBERS</span>
                </div>
                {memberIds.map((uid) => {
                  const last = lastOf(uid);
                  return (
                    <div key={uid} className="bs-member">
                      <Seal
                        text={profileOf(uid).seal_text}
                        color={profileOf(uid).seal_color}
                        styleType={profileOf(uid).seal_style}
                        image={profileOf(uid).seal_image}
                        size={30}
                      />
                      <div className="min-w-0">
                        <div className="bs-member-name">
                          {nameOf(uid)}
                          {uid === user.id && <span style={{ fontWeight: 400, color: '#a0937e' }}> (나)</span>}
                        </div>
                        <div className="bs-member-sub">
                          {last ? `최근 기록 · ${fmtMD(last)}` : '아직 기록이 없어요'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bs-mini-calendar">
                <div className="bs-calendar-head">
                  <div className="bs-calendar-month">
                    {y}년 {m + 1}월
                  </div>
                  <span style={{ fontSize: 10, color: '#9a8a72' }}>READING LOG</span>
                </div>
                <div className="bs-calendar-week">
                  {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="bs-calendar-days">
                  {cells.map((c, i) => (
                    <span
                      key={i}
                      className={`bs-calendar-day${c.muted ? ' bs-muted' : ''}${
                        !c.muted && marked.has(c.label) ? ' bs-marked' : ''
                      }${!c.muted && c.label === now.getDate() ? ' bs-today' : ''}`}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
                <div className="bs-calendar-foot">
                  <i className="bs-tiny-dot" /> 내가 기록을 남긴 날
                  <span style={{ marginLeft: 'auto' }}>이번 달 {marked.size}일</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (tab === 'shelf') {
    const filterKey = shelfFilter;
    const entries = buildShelfEntries(allReviews.filter(matchesFilter));
    const statusOf = (e: ShelfEntry) => shelfStatusOf(e.reviews);
    const hasStatus = (e: ShelfEntry, s: Status) => e.reviews.some((r) => r.status === s);
    const visible = entries.filter((e) => filterKey === 'all' || hasStatus(e, filterKey));
    const books = buildShelfEntries(allReviews);
    const countOf = (s: Status) => books.filter((e) => statusOf(e) === s).length;
    const withReview = books.filter((e) => e.reviews.some((r) => r.content.trim())).length;

    const filters: ['all' | Status, string, number][] = [
      ['all', '전체 서가', books.length],
      ['wishlist', '읽고 싶은 책', countOf('wishlist')],
      ['reading', '읽는 중', countOf('reading')],
      ['completed', '완독', countOf('completed')],
    ];

    return (
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <div className="bs-content">
          <div className="bs-page-head">
            <div className="bs-heading-copy">
              <div className="bs-eyebrow">THE SHARED LIBRARY · {pad2(books.length)} VOLUMES</div>
              <h1 className="bs-h1">우리의 공동 서재</h1>
              <p className="bs-lead">
                서로의 책장에 놓인 책들을 한곳에 모았습니다.
                <br />
                누가 읽고 있는지, 어떤 기록이 남아 있는지 천천히 둘러보세요.
              </p>
            </div>
            <button className="bs-btn bs-btn-primary" onClick={goWrite}>
              ＋ &nbsp; 책 등록
            </button>
          </div>

          <div className="bs-stats-grid" style={{ marginBottom: 22 }}>
            {[
              ['읽고 싶은 책', countOf('wishlist'), '언젠가 펼쳐 볼 페이지'],
              ['읽는 중', countOf('reading'), '서가 위에 펼쳐 둔 책'],
              ['완독한 책', countOf('completed'), '각자의 감상이 남아 있어요'],
              ['독후감이 있는 책', withReview, '기록으로 이어진 책'],
            ].map(([label, n, note]) => (
              <div key={label as string} className="bs-stat-card">
                <div className="bs-stat-label">{label}</div>
                <div className="bs-stat-number">
                  {pad2(n as number)}
                  <span style={{ fontSize: 13 }}> 권</span>
                </div>
                <div className="bs-stat-note">{note}</div>
              </div>
            ))}
          </div>

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
              visible.map((e, i) => {
                const uids = Array.from(new Set(e.reviews.map((r) => r.user_id)));
                const isSeries = e.type === 'series';
                const title = e.type === 'series' ? e.base : e.book.title;
                const author = e.type === 'series' ? e.author : e.book.author;
                const cover = e.type === 'series' ? e.cover : e.book.cover_url;
                return (
                  <article key={e.type === 'series' ? e.key : e.isbn} className="bs-book-card" onClick={() => openBook(e)}>
                    <div className="bs-book-card-top">
                      <span className="bs-book-ref">NO. {String(i + 1).padStart(3, '0')}</span>
                      <span className="bs-book-ref">{isSeries ? 'SERIES' : STATUS_LABEL[statusOf(e)]}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 17 }}>
                      <BookCover title={title} author={author} src={cover} width={87} />
                    </div>
                    <h3 className="bs-h3 bs-book-title">{title}</h3>
                    <div className="bs-book-author">{author}</div>
                    <div className="bs-book-divider" />
                    <div className="bs-book-card-foot">
                      <div className="bs-mini-avatars">
                        {uids.slice(0, 4).map((uid) => (
                          <Seal
                            key={uid}
                            text={profileOf(uid).seal_text}
                            color={profileOf(uid).seal_color}
                            styleType={profileOf(uid).seal_style}
                            image={profileOf(uid).seal_image}
                            size={22}
                          />
                        ))}
                      </div>
                      <span>
                        {e.type === 'series' ? `기록된 ${e.volumes.length}권` : STATUS_LABEL[statusOf(e)]}
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
        <Footer label="CATALOGUE" />
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
              <span style={{ fontSize: 11, color: '#8f806a', marginLeft: 7 }}>최신 기록부터 정리합니다.</span>
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
        <Footer label="INDEX" />
      </div>
    );
  }

  if (tab === 'quotes') {
    const mine = myReviews
      .flatMap((r) => (r.quotes || []).map((q) => ({ q, r })))
      .sort((a, b) => b.q.created_at.localeCompare(a.q.created_at));
    const f = boardFilter.trim().toLowerCase();
    const list = mine.filter(
      ({ q, r }) =>
        !f ||
        q.content.toLowerCase().includes(f) ||
        r.books.title.toLowerCase().includes(f) ||
        r.books.author.toLowerCase().includes(f) ||
        q.quote_comments.some((c) => c.content.toLowerCase().includes(f))
    );
    return (
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <div className="bs-content">
          <div className="bs-page-head">
            <div className="bs-heading-copy">
              <div className="bs-eyebrow">LOOSE LEAVES · PERSONAL</div>
              <h1 className="bs-h1">문장 수집장</h1>
              <p className="bs-lead">책 속에서 만난 문장과 그 옆에 적어 둔 메모를 보관합니다.</p>
            </div>
            <button className="bs-btn bs-btn-primary" onClick={() => goTab('mine')}>
              ❞ &nbsp; 책에서 문장 추가
            </button>
          </div>
          <div className="bs-home-grid">
            <div className="bs-records">
              {list.length === 0 ? (
                <div className="bs-empty-state">
                  <strong>{mine.length === 0 ? '아직 모아둔 문장이 없어요.' : '찾는 문장이 없어요.'}</strong>
                  <span>책 상세 화면에서 마음에 남은 문장을 적어 보세요.</span>
                </div>
              ) : (
                list.map(({ q, r }) => (
                  <article key={q.id} className="bs-record-row bs-quote-row" onClick={() => openReview(r)}>
                    <div className="bs-quote-mark">“</div>
                    <div className="min-w-0">
                      <div className="bs-record-excerpt" style={{ fontSize: 15, color: '#554635', marginBottom: 8 }}>
                        {plainText(q.content)}
                      </div>
                      {q.quote_comments.map((c) => (
                        <div key={c.id} className="bs-quote-comment">
                          ↳ {plainText(c.content)}
                        </div>
                      ))}
                      <div className="bs-record-meta">
                        <span>{r.books.title}</span>
                        <i className="bs-meta-dot" />
                        <span>{fmtMD(q.created_at)}</span>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="bs-right-stack">
              <div className="bs-memo-card">
                <div className="bs-memo-label">COLLECTED THOUGHTS</div>
                <p>
                  문장을 모으는 일은
                  <br />
                  마음이 잠시 멈춘 자리에
                  <br />
                  작은 표식을 남기는 일.
                </p>
                <div className="bs-memo-foot">
                  <span>나의 수집장</span>
                  <span>{pad2(mine.length)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer label="LOOSE LEAVES" />
      </div>
    );
  }

  const myShelf = myReviews.filter((r) => r.status !== 'wishlist');
  const myWishlist = myReviews.filter((r) => r.status === 'wishlist');
  const shelfList = myShelf.filter(matchesFilter);
  const wishList = myWishlist.filter(matchesFilter);
  const filterQ = boardFilter.trim().toLowerCase();
  const clipList = clippings.filter(
    (c) => !filterQ || `${c.title} ${c.source || ''}`.toLowerCase().includes(filterQ)
  );

  const searchOpen = searchResults.length > 0 || !!selectedBook;

  return (
    <div className="bs-main">
      <GlobalStyle />
      {header}
      <div className="bs-content">
        <div className="bs-page-head">
          <div className="bs-heading-copy">
            <div className="bs-eyebrow">MY DESK · PERSONAL RECORDS</div>
            <h1 className="bs-h1">나의 기록</h1>
            <p className="bs-lead">
              내가 고른 책과 남긴 기록, 붙여 둔 스크랩을 한곳에서 정리합니다.
            </p>
          </div>
        </div>
        <div className="bs-stats-grid" style={{ marginBottom: 22 }}>
          {[
            ['내가 읽은 책', myReviews.filter((r) => r.status === 'completed').length, '권'],
            ['읽는 중', myReviews.filter((r) => r.status === 'reading').length, '권'],
            ['읽고 싶은 책', myReviews.filter((r) => r.status === 'wishlist').length, '권'],
            ['모은 문장', myReviews.reduce((n, r) => n + (r.quotes?.length || 0), 0), '개'],
          ].map(([label, n, unit]) => (
            <div key={label as string} className="bs-stat-card">
              <div className="bs-stat-label">{label}</div>
              <div className="bs-stat-number">
                {pad2(n as number)}
                <span style={{ fontSize: 13 }}> {unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border border-[#d9cdbb] bg-[#fbf8f1] grid grid-cols-1 lg:grid-cols-12">
          <section
            className={`${
              searchOpen ? 'lg:col-span-4' : 'lg:col-span-3'
            } min-w-0 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-[#d9cdbb] space-y-5`}
          >
            <div className="border-b border-[#d9cdbb] pb-2">
              <p className="text-[11px] uppercase tracking-widest text-[#71675a]">New Entry</p>
              <h2 className="text-xl font-black tracking-tight">책 추가</h2>
            </div>

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
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className={LABEL}>검색 결과 {searchResults.length}건</span>
                  <button type="button" onClick={clearSearch} className={`${DANGER_BTN} shrink-0`}>
                    결과 지우기
                  </button>
                </div>
                <div className="divide-y divide-[#e5dac8] border-y border-[#d9cdbb] max-h-96 overflow-y-auto">
                  {searchResults.map((book, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={book.thumbnail || undefined}
                          alt={book.title}
                          className="w-11 h-16 object-cover border border-[#d9cdbb] bg-[#e9dfce] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{book.title}</p>
                          <p className="text-xs text-[#5c5245] truncate">{book.authors.join(', ')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedBook(book)}
                        className={`${BTN_OUTLINE} !min-h-[28px] !px-3 shrink-0`}
                      >
                        선택
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {selectedBook && (
              <div className="border border-[#d9cdbb] p-4 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black tracking-tight">새 책 서재에 추가</h3>
                  <div className="flex items-center gap-3 shrink-0">
                    {searchResults.length > 0 && (
                      <button onClick={() => setSelectedBook(null)} className={DANGER_BTN}>
                        다시 선택
                      </button>
                    )}
                    <button onClick={clearSearch} className={DANGER_BTN}>
                      취소
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-y border-[#d9cdbb] py-3">
                  <img
                    src={selectedBook.thumbnail || undefined}
                    alt={selectedBook.title}
                    className="w-12 h-16 object-cover border border-[#d9cdbb] bg-[#e9dfce] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm break-words">{selectedBook.title}</p>
                    <p className="text-xs text-[#5c5245] truncate">{selectedBook.authors.join(', ')}</p>
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
          </section>

          <div className={`${searchOpen ? 'lg:col-span-8' : 'lg:col-span-9'} min-w-0`}>
            <section>
              <div className="flex flex-wrap justify-between items-end gap-3 px-4 sm:px-5 py-4 border-b border-[#d9cdbb]">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-[#71675a]">My Shelf</p>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                    내 서재{' '}
                    <span className="text-sm font-semibold text-[#71675a]">총 {myShelf.length}권</span>
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
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-[#71675a]">
                  <p className="text-sm">
                    {myShelf.length === 0
                      ? '등록된 책이 없습니다. "책 추가"에서 책을 검색해 첫 글을 만들어 보세요.'
                      : '검색 결과가 없습니다.'}
                  </p>
                </div>
              ) : (
                renderBoard(asRows(shelfList), false)
              )}
            </section>

            <section className="border-t border-[#d9cdbb]">
              <div className="px-4 sm:px-5 py-4 border-b border-[#d9cdbb]">
                <p className="text-[11px] uppercase tracking-widest text-[#71675a]">Wish List</p>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  읽고 싶은 책{' '}
                  <span className="text-sm font-semibold text-[#71675a]">총 {myWishlist.length}권</span>
                </h2>
              </div>

              {wishList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-[#71675a]">
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

            <section className="border-t border-[#d9cdbb]">
              <div className="flex items-end justify-between gap-3 px-4 sm:px-5 py-4 border-b border-[#d9cdbb]">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-[#71675a]">Clippings</p>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                    스크랩{' '}
                    <span className="text-sm font-semibold text-[#71675a]">총 {clippings.length}개</span>
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="스크랩 추가"
                  title="스크랩 추가"
                  onClick={() => setClipModalOpen(true)}
                  className={`${BTN} !px-0 w-[34px] text-lg leading-none`}
                >
                  +
                </button>
              </div>

              {clipList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-[#71675a]">
                  <p className="text-sm">
                    {clippings.length === 0
                      ? '스크랩이 없습니다. 위의 + 버튼으로 기사 링크나 칼럼을 추가해 보세요.'
                      : '검색 결과가 없습니다.'}
                  </p>
                </div>
              ) : (
                <ul>
                  {clipList.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => openClip(c.id)}
                      className="px-4 sm:px-5 py-4 border-b border-[#d9cdbb] last:border-b-0 hover:bg-[#ece2d1] cursor-pointer transition-colors duration-200 group"
                    >
                      <p className="font-bold text-base break-words underline-offset-4 decoration-2 decoration-[#8d4d38] group-hover:underline">
                        {c.title}
                      </p>
                      <p className="mt-1 text-xs text-[#71675a] flex flex-wrap gap-x-3 gap-y-0.5">
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
      </div>

      {clipModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setClipModalOpen(false)}
          className="fixed inset-0 z-50 flex justify-center bg-[#4c4939]/60 p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl my-auto border border-[#d9cdbb] bg-[#fbf8f1] p-5 sm:p-6"
          >
            <div className="flex items-end justify-between gap-3 border-b border-[#d9cdbb] pb-2 mb-5">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#71675a]">New Clipping</p>
                <h2 className="text-xl font-black tracking-tight">스크랩 만들기</h2>
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
                  <p className="mt-1 text-xs font-semibold text-[#8d4d38] break-words">{clipFetchError}</p>
                )}
                <p className="mt-1 text-xs text-[#71675a]">
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
                <p className="mt-1 text-xs text-[#71675a]">
                  저장한 뒤에는 본문을 고칠 수 없어요. 형광펜과 각주 위치가 어긋나기 때문이에요. 불필요한
                  부분은 저장 전에 지워 주세요.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setClipModalOpen(false)}
                  className={`${BTN_OUTLINE} flex-1`}
                >
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

      <Footer />
    </div>
  );
}
