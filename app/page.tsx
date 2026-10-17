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
  rating_comment?: string | null;
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
        --bg: #f7f7f7; --side: #f1f1f1; --surface: #fff; --text: #111;
        --muted: #737373; --faint: #9a9a9a; --line: #d4d4d4;
        --line-dark: #9f9f9f; --soft: #e9e9e9; --sans: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
        --paper: #f7f7f7; --paper-light: #fff; --paper-deep: #e9e9e9;
        --ink: #111; --ink-soft: #737373; --ink-faint: #9a9a9a;
        --line-dark: #9f9f9f; --rust: #111; --rust-light: #e9e9e9;
        --olive: #737373; --olive-light: #e9e9e9; --blue: #111; --blue-light: #f1f1f1;
        --shadow: none;
      }
      *, *::before, *::after { box-sizing: border-box; }
      html { background: var(--bg) !important; scroll-behavior: smooth; }
      body, body *, body *::before, body *::after {
        font-family: var(--sans) !important; box-sizing: border-box;
      }
      body {
        margin: 0 !important; min-width: 320px; min-height: 100vh;
        color: var(--text) !important; background: var(--bg) !important;
        background-image: none !important; font-size: 16px !important; line-height: 1.6 !important;
      }
      button, input, textarea, select { color: inherit; font: inherit; }
      button { cursor: pointer; }
      button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, a:focus-visible {
        outline: 2px solid #111 !important; outline-offset: 2px !important;
      }
      ::selection { color: #fff !important; background: #333 !important; }

      /* The same fixed desktop rail used in the reference app. */
      .bs-main {
        display: block !important; position: relative !important;
        width: calc(100% - 250px) !important; min-height: 100vh !important;
        margin: 0 0 0 250px !important; padding: 0 !important;
        color: #111 !important; background: #f7f7f7 !important;
        overflow: visible !important;
      }
      .bs-sidebar {
        position: fixed !important; inset: 0 auto 0 0 !important; z-index: 30 !important;
        display: flex !important; flex-direction: column !important; align-items: stretch !important;
        width: 250px !important; min-width: 250px !important; height: 100vh !important; height: 100dvh !important;
        padding: 30px 23px !important; overflow-x: hidden !important; overflow-y: auto !important;
        color: #111 !important; background: #f1f1f1 !important;
        border: 0 !important; border-right: 1px solid #d4d4d4 !important; border-radius: 0 !important;
        box-shadow: none !important; transform: none; transition: transform .2s ease !important;
      }
      .bs-brand {
        display: flex !important; flex-direction: column !important; align-items: flex-start !important;
        justify-content: flex-start !important; margin: 0 6px 40px !important; padding: 0 !important;
        border: 0 !important; background: transparent !important; box-shadow: none !important;
      }
      .bs-brand-title {
        display: block !important; margin: 0 !important; padding: 0 !important;
        color: #111 !important; background: transparent !important; border: 0 !important;
        font-size: 50pt !important; font-weight: 900 !important; letter-spacing: -.09em !important;
        line-height: .83 !important; text-shadow: none !important;
      }
      .bs-brand-title br { display: block; }
      .bs-nav { display: grid !important; gap: 5px !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
      .bs-sidebar .bs-nav button {
        display: flex !important; width: 100% !important; min-width: 0 !important; height: 33px !important; min-height: 33px !important;
        align-items: center !important; justify-content: space-between !important; gap: 8px !important;
        margin: 0 !important; padding: 0 10px !important; color: #111 !important; text-align: left !important;
        background: transparent !important; border: 1px solid transparent !important; border-radius: 2px !important;
        box-shadow: none !important; transform: none !important; font-size: 16px !important; font-weight: 500 !important;
        letter-spacing: 0 !important; line-height: 1.4 !important; white-space: nowrap !important;
      }
      .bs-sidebar .bs-nav button:hover { background: #eaeaea !important; border-color: transparent !important; }
      .bs-sidebar .bs-nav button.bs-active {
        color: #111 !important; background: #e5e5e5 !important; border-color: #9f9f9f !important;
        box-shadow: none !important; font-weight: 700 !important;
      }
      .bs-nav-count {
        display: grid !important; min-width: 17px !important; width: auto !important; height: 17px !important;
        place-items: center !important; margin: 0 !important; padding: 0 3px !important;
        color: #fff !important; background: #171717 !important; border: 0 !important;
        font-size: 12px !important; font-weight: 500 !important; line-height: 1 !important;
      }
      .bs-side-spacer { display: block !important; flex: 1 0 24px !important; min-height: 24px !important; }
      .bs-side-bottom {
        display: flex !important; align-items: center !important; gap: 7px !important; margin: 0 !important;
        padding: 14px 0 0 !important; border-top: 1px solid #d4d4d4 !important; color: #737373 !important;
        background: transparent !important; font-size: 13px !important;
      }
      .bs-profile-settings {
        display: flex !important; align-items: center !important; gap: 8px !important; flex: 1 1 auto !important;
        min-width: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important;
        color: #111 !important; box-shadow: none !important; text-align: left !important;
      }
      .bs-profile-name { overflow: hidden !important; min-width: 0 !important; color: #333 !important; font-size: 14px !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .bs-settings-icon { flex: 0 0 auto; color: #737373; }
      .bs-logout-icon { display: grid !important; width: 26px !important; min-width: 26px !important; height: 28px !important; min-height: 28px !important; place-items: center !important; padding: 0 !important; border: 0 !important; background: transparent !important; color: #737373 !important; box-shadow: none !important; }
      .bs-mobile-menu-toggle, .bs-mobile-drawer-launcher, .bs-mobile-drawer-backdrop { display: none !important; }

      /* Page geometry and headings. */
      .bs-content {
        position: relative !important; width: min(1020px, 100%) !important; max-width: 1020px !important;
        min-height: 100vh !important; margin: 0 !important; padding: 50px 48px 90px 52px !important;
        background: transparent !important; color: #111 !important; box-shadow: none !important;
      }
      .bs-page-head {
        display: flex !important; width: 100% !important; min-height: 54px !important;
        align-items: flex-start !important; justify-content: space-between !important; gap: 24px !important;
        margin: 0 0 13px !important; padding: 0 !important; border: 0 !important; background: transparent !important;
      }
      .bs-heading-copy { max-width: none !important; min-width: 0 !important; }
      .bs-h1, .bs-page-head .bs-h1 {
        margin: 0 !important; color: #111 !important; font-size: 38px !important; font-weight: 850 !important;
        letter-spacing: -.055em !important; line-height: 1.2 !important; text-shadow: none !important;
        overflow-wrap: break-word !important; word-break: normal !important;
      }
      .bs-h3 { color: #111 !important; font-size: 21px !important; font-weight: 800 !important; letter-spacing: -.035em !important; }
      .bs-eyebrow, .bs-lead, .bs-head-mark, .bs-brand-sub, .bs-side-label { display: none !important; }
      .bs-main > main:not(.bs-book-detail-page) {
        width: min(1020px, 100%) !important; max-width: 1020px !important; min-height: 100vh !important;
        margin: 0 !important; padding: 50px 48px 90px 52px !important; background: transparent !important;
      }
      .bs-book-detail-page {
        display: block !important; width: min(1020px, 100%) !important; max-width: 1020px !important;
        min-height: 100vh !important; margin: 0 !important; padding: 50px 48px 90px 52px !important;
        background: transparent !important;
      }
      .bs-book-detail-shell { width: 100% !important; max-width: 100% !important; margin: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; }

      /* Consistent buttons, fields and search bars. */
      .bs-main button:not(.bs-pagination button):not(.bs-nav button):not(.bs-top-nav button):not(.bs-personal-book-card):not(.bs-scrapbook-card):not(.bs-book-card):not(.bs-delete-x):not(.bs-rating-star-button):not(.bs-mobile-drawer-launcher):not(.bs-mobile-drawer-backdrop):not(.bs-mobile-menu-toggle):not(.bs-search-clear):not(.bs-rating-comment-edit):not(.bs-rating-comment-save):not(.bs-rating-comment-cancel):not(.bs-rating-comment-input):not(.bs-note-action):not(.bs-note-action-primary):not(.bs-profile-settings):not(.bs-logout-icon):not([class*="underline"]):not(.bs-btn-primary):not(.bs-filter-btn):not([aria-pressed="true"]) {
        box-sizing: border-box !important; display: inline-flex !important; min-width: 0 !important; max-width: 100% !important;
        width: auto !important; height: 34px !important; min-height: 34px !important; max-height: 34px !important;
        align-items: center !important; justify-content: center !important; gap: 7px !important;
        padding: 0 13px !important; color: #111 !important; background: #fff !important; border: 1px solid #d4d4d4 !important;
        border-radius: 2px !important; box-shadow: none !important; transform: none !important;
        font-family: var(--sans) !important; font-size: 14px !important; font-weight: 600 !important;
        letter-spacing: 0 !important; line-height: 1.15 !important; text-decoration: none !important;
        white-space: nowrap !important; word-break: keep-all !important; overflow: hidden !important; text-overflow: ellipsis !important;
        transition: border-color .15s ease, background-color .15s ease !important;
      }
      .bs-main button:not(.bs-pagination button):not(.bs-nav button):not(.bs-top-nav button):not(.bs-personal-book-card):not(.bs-scrapbook-card):not(.bs-book-card):not(.bs-delete-x):not(.bs-rating-star-button):not(.bs-mobile-drawer-launcher):not(.bs-mobile-drawer-backdrop):not(.bs-mobile-menu-toggle):not(.bs-search-clear):not(.bs-rating-comment-edit):not(.bs-rating-comment-save):not(.bs-rating-comment-cancel):not(.bs-rating-comment-input):not(.bs-note-action):not(.bs-note-action-primary):not(.bs-profile-settings):not(.bs-logout-icon):not([class*="underline"]):not(.bs-btn-primary):not(.bs-filter-btn):not([aria-pressed="true"]):hover {
        color: #111 !important; background: #f1f1f1 !important; border-color: transparent !important; box-shadow: none !important;
      }
      /* Keep base, primary, and selected toggle buttons at identical dimensions.
         State changes should alter color only, never the control's height or spacing. */
      .bs-main button.bs-btn-primary,
      .bs-main button[aria-pressed="true"]:not(.bs-nav button):not(.bs-top-nav button):not(.bs-filter-btn):not(.bs-rating-star-button) {
        box-sizing: border-box !important; display: inline-flex !important; min-width: 0 !important; max-width: 100% !important;
        width: auto !important; height: 34px !important; min-height: 34px !important; max-height: 34px !important;
        align-items: center !important; justify-content: center !important; gap: 7px !important; padding: 0 13px !important;
        border-width: 1px !important; border-style: solid !important; border-radius: 2px !important;
        box-shadow: none !important; transform: none !important; font-family: var(--sans) !important;
        font-size: 14px !important; font-weight: 600 !important; letter-spacing: 0 !important; line-height: 1.15 !important;
        text-decoration: none !important; white-space: nowrap !important; word-break: keep-all !important;
        overflow: hidden !important; text-overflow: ellipsis !important;
      }
      .bs-main button.bs-btn-primary, .bs-main button[aria-pressed="true"]:not(.bs-nav button):not(.bs-top-nav button):not(.bs-filter-btn):not(.bs-rating-star-button) {
        color: #fff !important; background: #171717 !important; border-color: #171717 !important;
      }
      .bs-main button.bs-btn-primary:hover, .bs-main button[aria-pressed="true"]:not(.bs-nav button):not(.bs-top-nav button):not(.bs-filter-btn):not(.bs-rating-star-button):hover { color: #fff !important; background: #000 !important; }
      .bs-main button[class*="underline"], .bs-main button.bs-link-button, .bs-main button.bs-row-action {
        min-height: 28px !important; padding: 0 4px !important; background: transparent !important;
        border-color: transparent !important; color: #737373 !important; box-shadow: none !important;
      }
      .bs-main button[class*="underline"]:hover, .bs-main button.bs-link-button:hover, .bs-main button.bs-row-action:hover { text-decoration: underline !important; background: transparent !important; border-color: transparent !important; }
      .bs-main button:disabled { cursor: not-allowed !important; opacity: .45 !important; }
      .bs-main input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
      .bs-main textarea, .bs-main select {
        min-width: 0 !important; max-width: 100% !important; color: #111 !important; background: #fff !important;
        border: 1px solid #d4d4d4 !important; border-radius: 0 !important; box-shadow: none !important;
        font-family: var(--sans) !important; font-size: 11px !important; font-weight: 400 !important;
        letter-spacing: 0 !important; line-height: 1.55 !important; outline-offset: 2px;
      }
      .bs-main input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), .bs-main select { min-height: 34px !important; padding: 0 10px !important; }
      .bs-main textarea { min-height: 88px !important; padding: 10px !important; resize: vertical; }
      .bs-main input::placeholder, .bs-main textarea::placeholder { color: #9a9a9a !important; opacity: 1 !important; }
      .bs-main .bs-search-wrap { position: relative !important; display: flex !important; width: 100% !important; max-width: 800px !important; height: 34px !important; align-items: center !important; gap: 10px !important; margin: 14px 0 15px !important; padding: 0 11px !important; border: 1px solid #d4d4d4 !important; background: #fff !important; }
      .bs-main .bs-search-icon { position: static !important; display: inline-block !important; transform: none !important; color: #737373 !important; font-size: 15px !important; }
      .bs-main .bs-search-wrap .bs-search { width: auto !important; min-width: 0 !important; height: 30px !important; min-height: 30px !important; flex: 1 1 auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; outline: 0 !important; background: transparent !important; color: #111 !important; box-shadow: none !important; font-size: 15px !important; }
      .bs-search-clear { display: grid !important; width: 24px !important; min-width: 24px !important; height: 24px !important; min-height: 24px !important; place-items: center !important; padding: 0 !important; border: 0 !important; background: transparent !important; color: #737373 !important; font-size: 16px !important; }

      /* Community book archive: book rows, not floating cards. */
      .bs-community-shelf-page .bs-page-head { margin-bottom: 13px !important; }
      .bs-community-shelf-page .bs-record-cta { white-space: nowrap !important; }
      .bs-shelf-toolbar {
        display: flex !important; align-items: center !important; justify-content: space-between !important; flex-wrap: wrap !important;
        gap: 14px !important; margin: 28px 0 20px !important; padding: 0 0 10px !important;
        background: transparent !important; border: 0 !important; border-bottom: 0 !important; border-radius: 0 !important; box-shadow: none !important;
      }
      .bs-filter-group { display: flex !important; flex-wrap: wrap !important; gap: 5px !important; width: auto !important; }
      .bs-filter-btn {
        display: inline-flex !important; height: 30px !important; min-height: 30px !important; max-height: 30px !important; align-items: center !important; gap: 6px !important;
        padding: 0 8px !important; color: #737373 !important; background: transparent !important;
        border: 1px solid transparent !important; border-radius: 2px !important; font-size: 14px !important; font-weight: 500 !important;
      }
      .bs-filter-btn.bs-active { color: #111 !important; background: #e5e5e5 !important; border-color: #9f9f9f !important; font-weight: 700 !important; }
      .bs-filter-btn:hover { background: #eaeaea !important; border-color: #d4d4d4 !important; }
      .bs-shelf-count, .bs-scrapbook-count { color: #737373 !important; font-size: 14px !important; white-space: nowrap !important; }
      .bs-books-grid, .bs-personal-book-list, .bs-records, .bs-scrapbook-list {
        display: block !important; width: 100% !important; margin: 14px 0 0 !important; padding: 0 !important;
        border: 0 !important; border-top: 1px solid #d4d4d4 !important; background: transparent !important;
      }
      .bs-book-card {
        display: block !important; position: relative !important; width: 100% !important; min-width: 0 !important; min-height: 142px !important;
        margin: 0 !important; padding: 15px 1px !important; background: transparent !important; border: 0 !important;
        border-bottom: 1px solid #d4d4d4 !important; border-radius: 0 !important; box-shadow: none !important;
        transform: none !important; cursor: pointer !important; transition: background-color .15s ease !important;
      }
      .bs-book-card:hover { background: #f3f3f3 !important; box-shadow: none !important; }
      .bs-book-card::before { display: none !important; content: none !important; }
      .bs-book-card-main { display: grid !important; grid-template-columns: 75px minmax(0,1fr) !important; gap: 18px !important; align-items: center !important; min-width: 0 !important; }
      .bs-book-card-cover { display: flex !important; width: 75px !important; min-width: 75px !important; align-items: center !important; justify-content: center !important; }
      .bs-book-cover, .bs-cover-img {
        display: block !important; width: 75px !important; height: 112px !important; max-width: none !important;
        flex: 0 0 auto !important; object-fit: cover !important; overflow: hidden !important;
        color: #111 !important; background: #ddd !important; border: 1px solid #777 !important;
        border-radius: 0 !important; box-shadow: none !important; filter: none !important;
      }
      .bs-cover-img { height: auto !important; }
      .bs-cover-inner { display: flex !important; height: 100% !important; flex-direction: column !important; justify-content: space-between !important; align-items: stretch !important; padding: 10px 7px 8px !important; }
      .bs-cover-title {
        max-height: 70% !important; overflow: hidden !important; color: inherit !important; font-size: 12px !important;
        font-weight: 800 !important; line-height: 1.35 !important; letter-spacing: -.02em !important;
        text-align: left !important; writing-mode: horizontal-tb !important; text-orientation: mixed !important;
        overflow-wrap: break-word !important; word-break: normal !important;
      }
      .bs-cover-author { margin: 4px 0 0 !important; color: inherit !important; font-size: 8px !important; font-weight: 500 !important; letter-spacing: 0 !important; text-align: left !important; }
      .bs-book-card-info { display: flex !important; min-width: 0 !important; min-height: 112px !important; flex-direction: column !important; align-items: stretch !important; justify-content: center !important; padding: 0 !important; }
      .bs-book-card h3.bs-book-title, .bs-book-card h3.bs-book-title:hover, .bs-record-title, .bs-personal-book-title, .bs-scrapbook-title {
        display: block !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important;
        color: #111 !important; font-size: 19px !important; font-weight: 750 !important; letter-spacing: -.025em !important;
        line-height: 1.45 !important; text-align: left !important; text-shadow: none !important;
        overflow-wrap: break-word !important; word-break: normal !important;
      }
      .bs-book-card .bs-book-author, .bs-personal-book-author { margin: 5px 0 0 !important; color: #737373 !important; font-size: 14px !important; font-weight: 400 !important; line-height: 1.55 !important; text-align: left !important; }
      .bs-book-card-quote { display: -webkit-box !important; overflow: hidden !important; margin: 12px 0 0 !important; color: #333 !important; font-size: 11px !important; font-style: normal !important; font-weight: 400 !important; line-height: 1.7 !important; -webkit-box-orient: vertical !important; -webkit-line-clamp: 2 !important; }
      .bs-book-rating { display: flex !important; align-items: center !important; gap: 7px !important; margin-top: 8px !important; color: #737373 !important; font-size: 10px !important; }
      .bs-rating-stars { color: #111 !important; letter-spacing: .03em !important; }
      .bs-rating-meta { color: #737373 !important; font-size: 12px !important; }
      .bs-book-card-readers, .bs-book-readers { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; margin-top: 10px !important; padding: 0 !important; border: 0 !important; }
      .bs-book-reader { display: inline-flex !important; align-items: center !important; gap: 5px !important; color: #737373 !important; font-size: 13px !important; }
      .bs-reader-name { max-width: 110px !important; overflow: hidden !important; color: #737373 !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .bs-record-row {
        display: grid !important; width: 100% !important; min-height: 142px !important;
        grid-template-columns: 75px minmax(0,1fr) !important; gap: 18px !important; align-items: center !important;
        margin: 0 !important; padding: 15px 1px !important; color: #111 !important; background: transparent !important;
        border: 0 !important; border-bottom: 1px solid #d4d4d4 !important; border-radius: 0 !important; box-shadow: none !important;
        cursor: pointer !important; transform: none !important;
      }
      .bs-record-row:hover { background: #f3f3f3 !important; box-shadow: none !important; }
      .bs-record-row .bs-cover-img, .bs-record-row .bs-book-cover { width: 75px !important; height: 112px !important; }
      .bs-record-title { font-size: 16px !important; }
      .bs-record-excerpt { display: -webkit-box !important; overflow: hidden !important; margin: 12px 0 !important; color: #333 !important; font-size: 14px !important; line-height: 1.7 !important; -webkit-box-orient: vertical !important; -webkit-line-clamp: 2 !important; }
      .bs-record-meta { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; color: #737373 !important; font-size: 9px !important; }
      .bs-meta-dot { display: inline-block !important; width: 3px !important; height: 3px !important; border-radius: 50% !important; background: #9a9a9a !important; }

      /* Personal shelf and saved clippings use the same quiet list pattern. */
      .bs-personal-book-card {
        display: grid !important; width: 100% !important; min-width: 0 !important; min-height: 142px !important;
        grid-template-columns: 75px minmax(0,1fr) 118px 16px !important; gap: 18px !important; align-items: center !important;
        margin: 0 !important; padding: 15px 1px !important; color: #111 !important; background: transparent !important;
        border: 0 !important; border-bottom: 1px solid #d4d4d4 !important; border-radius: 0 !important; box-shadow: none !important;
        text-align: left !important; transform: none !important; transition: background-color .15s ease !important;
      }
      .bs-personal-book-card:hover { background: #f3f3f3 !important; }
      .bs-personal-book-cover { display: flex !important; width: 75px !important; min-width: 75px !important; align-items: center !important; justify-content: center !important; }
      .bs-personal-book-cover .bs-book-cover, .bs-personal-book-cover .bs-cover-img { width: 75px !important; height: 112px !important; }
      .bs-personal-book-info { display: flex !important; min-width: 0 !important; flex-direction: column !important; align-items: flex-start !important; justify-content: center !important; gap: 0 !important; }
      .bs-personal-book-meta { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 6px !important; margin-top: 8px !important; }
      .bs-personal-status { display: inline-flex !important; min-height: 19px !important; align-items: center !important; padding: 0 5px !important; color: #555 !important; background: #e7e7e7 !important; border: 0 !important; font-size: 9px !important; font-weight: 500 !important; white-space: nowrap !important; }
      .bs-status-reading { color: #fff !important; background: #444 !important; }
      .bs-status-wishlist { color: #555 !important; background: transparent !important; border: 1px solid #c7c7c7 !important; }
      .bs-personal-rating { display: inline-flex !important; align-items: center !important; gap: 4px !important; color: #737373 !important; font-size: 9px !important; }
      .bs-personal-book-date { margin-top: 7px !important; color: #737373 !important; font-size: 9px !important; }
      .bs-personal-book-side { display: flex !important; height: 100% !important; align-items: flex-end !important; justify-content: space-between !important; flex-direction: column !important; padding: 7px 0 !important; gap: 8px !important; }
      .bs-personal-book-arrow, .bs-scrapbook-arrow { color: #737373 !important; font-size: 14px !important; }
      .bs-scrapbook-toolbar { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 30px !important; margin: 0 0 15px !important; padding: 0 !important; background: transparent !important; border: 0 !important; box-shadow: none !important; }
      .bs-scrapbook-toolbar .bs-search-wrap { max-width: 380px !important; margin: 0 !important; }
      .bs-scrapbook-card {
        display: flex !important; width: 100% !important; min-height: 0 !important; align-items: flex-start !important; justify-content: space-between !important;
        gap: 20px !important; margin: 0 !important; padding: 23px 0 21px !important; color: #111 !important;
        background: transparent !important; border: 0 !important; border-bottom: 1px solid #d4d4d4 !important;
        border-radius: 0 !important; box-shadow: none !important; text-align: left !important; transform: none !important;
      }
      .bs-scrapbook-card:hover { background: #f3f3f3 !important; }
      .bs-scrapbook-card-main { min-width: 0 !important; flex: 1 1 auto !important; overflow-wrap: break-word !important; }
      .bs-scrapbook-title { font-size: 19px !important; font-weight: 750 !important; letter-spacing: -.025em !important; }
      .bs-scrapbook-card:hover .bs-scrapbook-title { text-decoration: underline !important; text-underline-offset: 3px !important; }
      .bs-scrapbook-source { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 7px !important; margin: 7px 0 0 !important; color: #737373 !important; font-size: 12px !important; }
      .bs-scrapbook-source i { font-style: normal !important; }
      .bs-scrapbook-excerpt { display: -webkit-box !important; overflow: hidden !important; margin: 13px 0 !important; color: #444 !important; font-size: 11px !important; line-height: 1.7 !important; text-overflow: ellipsis !important; -webkit-box-orient: vertical !important; -webkit-line-clamp: 2 !important; }
      .bs-scrapbook-meta { display: flex !important; align-items: center !important; gap: 12px !important; color: #737373 !important; font-size: 12px !important; }
      .bs-scrapbook-arrow { flex: 0 0 auto !important; }
      .bs-empty-state { padding: 70px 0 !important; color: #737373 !important; border: 0 !important; border-top: 1px solid #d4d4d4 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; text-align: center !important; }
      .bs-empty-state strong { display: block !important; margin: 0 0 8px !important; color: #111 !important; font-size: 15px !important; font-weight: 700 !important; }
      .bs-empty-state span { color: #737373 !important; font-size: 11px !important; }

      /* Book details: cover/title, a simple rating ledger, quotation and review sections. */
      .bs-book-detail-hero {
        display: block !important; margin: 0 !important; padding: 26px 0 34px !important;
        background: transparent !important; border: 0 !important; border-bottom: 1px solid #9f9f9f !important;
        border-radius: 0 !important; box-shadow: none !important;
      }
      .bs-book-detail-hero > div:first-child { display: grid !important; grid-template-columns: 112px minmax(0,1fr) !important; gap: 28px !important; align-items: center !important; min-width: 0 !important; }
      .bs-book-detail-cover { display: block !important; width: 112px !important; height: 158px !important; min-width: 0 !important; object-fit: cover !important; border: 1px solid #777 !important; background: #ddd !important; box-shadow: none !important; }
      .bs-book-detail-hero > div:first-child > div { min-width: 0 !important; }
      .bs-book-detail-hero h2 { max-width: 720px !important; margin: 8px 0 5px !important; color: #111 !important; font-size: 31px !important; font-weight: 850 !important; letter-spacing: -.055em !important; line-height: 1.25 !important; overflow-wrap: break-word !important; word-break: normal !important; }
      .bs-book-detail-hero p { margin: 0 !important; color: #737373 !important; font-size: 11px !important; line-height: 1.6 !important; }
      .bs-series-volume-tabs { display: flex !important; flex-wrap: wrap !important; gap: 5px !important; margin-top: 12px !important; }
      .bs-series-volume-button { min-height: 30px !important; padding: 0 9px !important; font-size: 10px !important; }
      .bs-book-rating-section { display: block !important; margin: 48px 0 0 !important; padding: 0 0 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; }
      .bs-book-rating-heading { display: block !important; margin: 0 0 0 !important; padding: 0 0 10px !important; color: #111 !important; border-bottom: 1px solid #9f9f9f !important; font-size: 21px !important; font-weight: 750 !important; letter-spacing: -.02em !important; }
      .bs-book-rating-content { display: block !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; }
      .bs-book-rating-row { display: flex !important; justify-content: flex-start !important; gap: 12px !important; align-items: center !important; min-height: 50px !important; margin: 0 !important; padding: 0 !important; color: #111 !important; border-bottom: 1px solid #d4d4d4 !important; background: transparent !important; }
      .bs-book-rating-name { min-width: 0 !important; overflow: hidden !important; color: #111 !important; font-size: 15px !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .bs-book-rating-row strong { display: none !important; }
      .bs-book-rating-empty { margin: 0 !important; padding: 16px 0 !important; color: #737373 !important; border-bottom: 1px solid #d4d4d4 !important; font-size: 11px !important; }
      .bs-book-detail-sections { display: block !important; margin: 0 !important; padding: 0 !important; }
      .bs-book-detail-sections > div { display: block !important; min-width: 0 !important; }
      .bs-book-detail-section { display: block !important; min-width: 0 !important; margin: 48px 0 0 !important; padding: 0 0 22px !important; background: transparent !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
      .bs-book-detail-section h3, .bs-book-community-panel h3 { display: flex !important; align-items: baseline !important; justify-content: space-between !important; gap: 10px !important; margin: 0 !important; padding: 0 0 10px !important; color: #111 !important; border-bottom: 1px solid #9f9f9f !important; font-size: 17px !important; font-weight: 800 !important; letter-spacing: -.03em !important; line-height: 1.35 !important; }
      .bs-book-detail-section h3 span, .bs-book-community-panel h3 span { color: #737373 !important; font-size: 10px !important; font-weight: 500 !important; letter-spacing: 0 !important; }
      .bs-book-detail-section > p { color: #737373 !important; font-size: 10px !important; }
      .bs-book-detail-section form { display: flex !important; align-items: flex-end !important; gap: 12px !important; margin: 20px 0 0 !important; padding: 16px 0 0 !important; border-top: 1px solid #d4d4d4 !important; }
      .bs-book-detail-section form > div { min-width: 0 !important; flex: 1 1 auto !important; }
      .bs-book-community-panel { display: block !important; margin: 48px 0 0 !important; padding: 0 0 22px !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; }
      .bs-book-community-panel h3 { margin: 0 !important; }
      .bs-book-community-panel > div { border-color: #d4d4d4 !important; }
      .bs-book-detail-shell > .flex.justify-between { margin-top: 35px !important; padding: 16px 0 0 !important; border-top: 1px solid #d4d4d4 !important; }
      .bs-quote-list { display: block !important; margin-top: 14px !important; padding: 0 !important; border-top: 1px solid #d4d4d4 !important; }
      .bs-quote-row { display: block !important; min-width: 0 !important; margin: 0 !important; padding: 22px 2px !important; background: transparent !important; border: 0 !important; border-bottom: 1px solid #d4d4d4 !important; border-radius: 0 !important; box-shadow: none !important; }
      .bs-quote-row-main { display: flex !important; align-items: flex-start !important; justify-content: space-between !important; gap: 12px !important; min-width: 0 !important; }
      .bs-quote-text { flex: 1 1 auto !important; min-width: 0 !important; margin: 0 !important; color: #111 !important; font-size: 17px !important; font-weight: 600 !important; line-height: 1.85 !important; overflow-wrap: break-word !important; word-break: normal !important; }
      .bs-quote-text p { margin: 0 0 8px !important; }
      .bs-quote-editable { cursor: pointer !important; }
      .bs-delete-x { display: inline-flex !important; width: 20px !important; min-width: 20px !important; height: 24px !important; min-height: 24px !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; color: #cfa5a5 !important; background: transparent !important; border: 0 !important; box-shadow: none !important; font-size: 16px !important; font-weight: 400 !important; line-height: 1 !important; }
      .bs-delete-x:hover { color: #b98484 !important; background: transparent !important; }
      .bs-quote-comments { display: grid !important; gap: 9px !important; margin: 15px 0 0 24px !important; padding-left: 12px !important; border-left: 1px solid #d4d4d4 !important; }
      .bs-quote-comment-row { display: flex !important; align-items: flex-start !important; gap: 8px !important; min-width: 0 !important; color: #444 !important; font-size: 10px !important; line-height: 1.65 !important; }
      .bs-quote-comment-row > span, .bs-quote-comment-row > div { min-width: 0 !important; }
      .bs-quote-comment-form { display: flex !important; align-items: center !important; gap: 8px !important; margin: 7px 0 0 12px !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
      .bs-quote-comment-form input { min-width: 0 !important; flex: 1 1 auto !important; }
      .bs-prose .ProseMirror { min-height: 0 !important; outline: none !important; color: #111 !important; font-size: 14px !important; line-height: 2.05 !important; }
      .bs-prose .ProseMirror > *:first-child { margin-top: 0 !important; }
      .bs-prose .ProseMirror p { margin: 0 0 18px !important; }
      .bs-prose .ProseMirror h2 { margin: 1.3em 0 .5em !important; font-size: 22px !important; font-weight: 800 !important; letter-spacing: -.03em !important; }
      .bs-prose .ProseMirror h3 { margin: 1.2em 0 .45em !important; font-size: 17px !important; font-weight: 800 !important; }
      .bs-prose .ProseMirror blockquote { margin: 1em 0 !important; padding: 2px 0 2px 14px !important; color: #444 !important; border: 0 !important; border-left: 1px solid #9f9f9f !important; background: transparent !important; box-shadow: none !important; }
      .bs-prose .ProseMirror ul { list-style: disc !important; padding-left: 1.4em !important; margin: 0 0 .9em !important; }
      .bs-prose .ProseMirror ol { list-style: decimal !important; padding-left: 1.5em !important; margin: 0 0 .9em !important; }
      .bs-prose .ProseMirror li p { margin: 0 0 .3em !important; }

      /* Scrap article typography and annotation tools. */
      .bs-scrap-detail-page > main { width: min(940px,100%) !important; max-width: 940px !important; margin: 0 !important; padding: 49px 44px 90px 49px !important; }
      .scrap-detail-article { width: 100% !important; min-width: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; }
      .scrap-detail-header { margin: 0 !important; padding: 15px 0 28px !important; border: 0 !important; border-bottom: 1px solid #9f9f9f !important; background: transparent !important; }
      .scrap-detail-header h2 { max-width: 720px !important; margin: 11px 0 12px !important; color: #111 !important; font-size: 29px !important; font-weight: 850 !important; letter-spacing: -.045em !important; line-height: 1.35 !important; overflow-wrap: break-word !important; word-break: normal !important; }
      .scrap-detail-header p { display: flex !important; flex-wrap: wrap !important; gap: 3px 12px !important; color: #737373 !important; font-size: 10px !important; }
      .scrap-detail-header a, .scrap-detail-content a { color: #111 !important; text-decoration: underline !important; text-decoration-color: #9f9f9f !important; text-underline-offset: 3px !important; text-decoration-thickness: 1px !important; overflow-wrap: anywhere !important; }
      .scrap-detail-content { width: min(720px,100%) !important; min-width: 0 !important; margin: 0 auto !important; padding: 36px 0 !important; overflow-wrap: break-word !important; color: #111 !important; background: transparent !important; border: 0 !important; font-size: 14px !important; line-height: 2.05 !important; }
      .scrap-detail-content > div:first-child { color: #111 !important; font-size: 14px !important; line-height: 2.05 !important; white-space: pre-wrap !important; overflow-wrap: break-word !important; }
      .scrap-detail-content sup { display: inline-grid !important; width: 15px !important; height: 15px !important; place-items: center !important; margin-left: 4px !important; color: #fff !important; background: #333 !important; border-radius: 50% !important; font-size: 8px !important; line-height: 1 !important; }
      .bs-highlight-records { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 22px 0 0 !important; border: 0 !important; border-top: 1px solid #d4d4d4 !important; }
      .bs-highlight-records h3, .scrap-detail-content h3 { margin: 0 !important; color: #111 !important; font-size: 17px !important; font-weight: 800 !important; letter-spacing: -.03em !important; }
      .bs-highlight-record { display: flex !important; gap: 13px !important; padding: 17px 0 !important; border-bottom: 1px solid #d4d4d4 !important; }
      .bs-highlight-color { width: 8px !important; height: 8px !important; margin-top: 7px !important; border: 0 !important; border-radius: 0 !important; }
      .bs-scrap-detail-page > main > div > aside { border: 0 !important; background: transparent !important; box-shadow: none !important; }
      .bs-scrap-detail-page > main > div > aside > div { border: 1px solid #d4d4d4 !important; background: #fff !important; }
      .bs-scrap-detail-page > main > div > aside > div > div:first-child { color: #737373 !important; background: #e9e9e9 !important; border-bottom: 1px solid #d4d4d4 !important; font-size: 10px !important; letter-spacing: .12em !important; }
      .bs-modal-backdrop { position: fixed !important; inset: 0 !important; z-index: 100 !important; display: flex !important; align-items: center !important; justify-content: center !important; overflow-y: auto !important; padding: 20px !important; background: rgba(0,0,0,.38) !important; }
      .bs-modal-panel { width: min(560px,100%) !important; max-height: min(720px,90vh) !important; overflow: auto !important; margin: auto !important; padding: 24px !important; color: #111 !important; background: #f7f7f7 !important; border: 1px solid #777 !important; border-radius: 0 !important; box-shadow: 0 12px 40px rgba(0,0,0,.18) !important; }
      .bs-modal-head { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 16px !important; margin-bottom: 22px !important; padding-bottom: 14px !important; border-bottom: 1px solid #d4d4d4 !important; }
      .bs-modal-head h2 { margin: 0 !important; color: #111 !important; font-size: 21px !important; font-weight: 850 !important; letter-spacing: -.03em !important; }
      .bs-modal-eyebrow { margin: 0 0 5px !important; color: #737373 !important; font-size: 9px !important; letter-spacing: .08em !important; }
      .bs-book-search-form { margin-bottom: 22px !important; }
      .bs-book-search-results { margin-top: 18px !important; border-top: 1px solid #d4d4d4 !important; }
      .bs-book-search-result { display: grid !important; grid-template-columns: 42px minmax(0,1fr) auto !important; gap: 12px !important; align-items: center !important; padding: 11px 2px !important; border-bottom: 1px solid #d4d4d4 !important; }
      .bs-book-search-result img, .bs-selected-book img { display: block !important; width: 42px !important; height: 58px !important; object-fit: cover !important; background: #e4e4e4 !important; border: 1px solid #d4d4d4 !important; }
      .bs-selected-book { margin-top: 18px !important; padding-top: 18px !important; border-top: 1px solid #d4d4d4 !important; }
      .bs-selected-book img { width: 56px !important; height: 80px !important; }

      /* Persistent page height and the responsive left drawer. */
      .bs-main > .bs-content, .bs-main > .bs-book-detail-page, .bs-main > main { min-height: 100vh !important; }
      .bs-mobile-bottom-nav { display: none !important; }
      @media (max-width: 1200px) {
        .bs-content, .bs-main > main:not(.bs-book-detail-page), .bs-book-detail-page, .bs-scrap-detail-page > main { padding-left: 36px !important; padding-right: 30px !important; }
      }
      @media (max-width: 900px) {
        .bs-sidebar { width: 202px !important; min-width: 202px !important; padding-left: 19px !important; padding-right: 19px !important; }
        .bs-main { width: calc(100% - 202px) !important; margin-left: 202px !important; }
        .bs-content, .bs-main > main:not(.bs-book-detail-page), .bs-book-detail-page, .bs-scrap-detail-page > main { padding: 32px 24px 70px !important; }
        .bs-book-card-main { grid-template-columns: 75px minmax(0,1fr) !important; }
      }
      @media (max-width: 720px) {
        .bs-mobile-drawer-launcher {
          position: fixed !important; top: 16px !important; left: 0 !important; right: auto !important; z-index: 45 !important;
          display: inline-flex !important; width: 38px !important; min-width: 38px !important; height: auto !important; min-height: 0 !important;
          align-items: center !important; justify-content: center !important; padding: 12px 7px !important;
          color: #111 !important; background: #f1f1f1 !important; border: 1px solid #d4d4d4 !important; border-left: 0 !important; border-radius: 0 3px 3px 0 !important; box-shadow: none !important;
        }
        .bs-vertical-wordmark { writing-mode: vertical-rl !important; text-orientation: upright !important; white-space: nowrap !important; font-size: 15px !important; font-weight: 900 !important; letter-spacing: .08em !important; line-height: 1.15 !important; }
        .bs-mobile-drawer-launcher.is-open { display: none !important; }
        .bs-mobile-drawer-backdrop { position: fixed !important; inset: 0 !important; z-index: 25 !important; display: block !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: rgba(0,0,0,.3) !important; }
        .bs-sidebar {
          position: fixed !important; inset: 0 auto 0 0 !important; z-index: 40 !important; width: min(250px,82vw) !important; min-width: 0 !important;
          height: 100vh !important; height: 100dvh !important; min-height: 100vh !important; padding: 27px 19px !important;
          overflow-y: auto !important; background: #f1f1f1 !important; border-right: 1px solid #d4d4d4 !important;
          transform: translateX(-105%) !important; transition: transform .2s ease !important;
        }
        .bs-sidebar.bs-mobile-nav-open { transform: translateX(0) !important; }
        .bs-brand { position: relative !important; margin-bottom: 40px !important; padding: 0 32px 0 6px !important; }
        .bs-brand-title { font-size: 50pt !important; line-height: .88 !important; letter-spacing: -.09em !important; }
        .bs-mobile-menu-toggle { position: absolute !important; top: 0 !important; right: 0 !important; display: inline-flex !important; width: 30px !important; min-width: 30px !important; height: 30px !important; min-height: 30px !important; align-items: center !important; justify-content: center !important; padding: 0 !important; color: #111 !important; background: transparent !important; border: 1px solid #d4d4d4 !important; border-radius: 2px !important; box-shadow: none !important; }
        .bs-nav { display: grid !important; gap: 5px !important; margin-top: 0 !important; }
        .bs-sidebar .bs-nav button { width: 100% !important; min-height: 44px !important; height: 44px !important; justify-content: space-between !important; padding: 0 12px !important; font-size: 17px !important; }
        .bs-side-spacer { display: block !important; flex: 1 0 24px !important; }
        .bs-side-bottom { display: flex !important; margin-top: 20px !important; }
        .bs-main { width: 100% !important; margin-left: 0 !important; padding: 0 !important; overflow: clip !important; }
        .bs-content, .bs-main > main:not(.bs-book-detail-page), .bs-book-detail-page, .bs-scrap-detail-page > main {
          width: 100% !important; max-width: none !important; min-height: 100vh !important; margin: 0 !important; padding: 42px 18px 70px 58px !important;
        }
        .bs-page-head { min-height: 54px !important; align-items: flex-start !important; justify-content: space-between !important; gap: 12px !important; flex-wrap: wrap !important; margin-bottom: 13px !important; }
        .bs-h1, .bs-page-head .bs-h1 { font-size: 32px !important; line-height: 1.2 !important; }
        .bs-search-wrap { max-width: none !important; }
        .bs-shelf-toolbar { align-items: flex-start !important; gap: 8px !important; margin-top: 24px !important; }
        .bs-filter-group { width: 100% !important; }
        .bs-filter-btn { min-height: 36px !important; height: 36px !important; padding: 0 9px !important; font-size: 13px !important; }
        .bs-books-grid, .bs-personal-book-list, .bs-records, .bs-scrapbook-list { margin-top: 14px !important; }
        .bs-book-card { min-height: 124px !important; padding: 15px 1px !important; }
        .bs-book-card-main { grid-template-columns: 61px minmax(0,1fr) !important; gap: 12px !important; }
        .bs-book-card-cover, .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img { width: 61px !important; min-width: 61px !important; height: 92px !important; }
        .bs-book-card-info { min-height: 92px !important; }
        .bs-book-card h3.bs-book-title, .bs-book-card h3.bs-book-title:hover, .bs-record-title, .bs-personal-book-title, .bs-scrapbook-title { font-size: 17px !important; }
        .bs-book-card-quote, .bs-record-excerpt, .bs-scrapbook-excerpt { margin-top: 8px !important; font-size: 13px !important; -webkit-line-clamp: 1 !important; }
        .bs-book-card-readers, .bs-book-readers { gap: 7px !important; margin-top: 8px !important; }
        .bs-record-row { min-height: 124px !important; grid-template-columns: 61px minmax(0,1fr) !important; gap: 12px !important; padding: 15px 1px !important; }
        .bs-record-row .bs-cover-img, .bs-record-row .bs-book-cover { width: 61px !important; height: 92px !important; }
        .bs-personal-book-card { min-height: 124px !important; grid-template-columns: 61px minmax(0,1fr) auto !important; gap: 12px !important; padding: 15px 1px !important; }
        .bs-personal-book-arrow { display: none !important; }
        .bs-personal-book-side { align-items: flex-end !important; padding: 6px 0 !important; gap: 8px !important; }
        .bs-personal-book-date { white-space: nowrap !important; }
        .bs-personal-book-cover, .bs-personal-book-cover .bs-cover-img, .bs-personal-book-cover .bs-book-cover { width: 61px !important; min-width: 61px !important; height: 92px !important; }
        .bs-personal-book-date { font-size: 9px !important; }
        .bs-scrapbook-toolbar { align-items: stretch !important; flex-direction: column !important; gap: 10px !important; margin-bottom: 15px !important; }
        .bs-scrapbook-toolbar .bs-search-wrap { max-width: none !important; }
        .bs-scrapbook-count { align-self: flex-end !important; }
        .bs-scrapbook-card { gap: 12px !important; padding: 23px 0 21px !important; }
        .bs-book-detail-hero { padding: 22px 0 28px !important; }
        .bs-book-detail-hero > div:first-child { grid-template-columns: 88px minmax(0,1fr) !important; gap: 18px !important; }
        .bs-book-detail-cover { width: 88px !important; height: 124px !important; }
        .bs-book-detail-hero h2 { font-size: 24px !important; letter-spacing: -.04em !important; }
        .bs-book-rating-section, .bs-book-detail-section, .bs-book-community-panel { margin-top: 35px !important; }
        .bs-book-rating-row { grid-template-columns: auto minmax(0,1fr) !important; gap: 10px !important; }
        .bs-book-detail-section form { align-items: stretch !important; flex-direction: column !important; }
        .bs-quote-row { padding: 18px 0 !important; }
        .bs-quote-text { font-size: 14px !important; }
        .bs-quote-comments { margin-left: 8px !important; padding-left: 8px !important; }
        .bs-quote-comment-form { margin-left: 0 !important; flex-wrap: wrap !important; }
        .bs-scrap-detail-page > main { padding-top: 49px !important; }
        .scrap-detail-header { padding: 15px 0 24px !important; }
        .scrap-detail-header h2 { font-size: 25px !important; }
        .scrap-detail-content { padding: 28px 0 !important; font-size: 14px !important; }
        .scrap-detail-article > aside { display: none !important; }
        .bs-modal-panel { padding: 18px !important; }
        .bs-main > main > div { grid-template-columns: minmax(0,1fr) !important; }
      }

      /* Readability pass: larger type and fixed responsive shell. */
      body, body * { text-rendering: optimizeLegibility; }
      body { font-size: 16px !important; }
      .bs-main small, .bs-main .text-xs, .bs-main [class*="text-[9px]"], .bs-main [class*="text-[10px]"], .bs-main [class*="text-[11px]"], .bs-main [class*="text-[12px]"] { font-size: 13px !important; }
      .bs-main .text-sm { font-size: 15px !important; }
      .bs-main .text-base { font-size: 17px !important; }
      .bs-sidebar { width: 250px !important; min-width: 250px !important; padding: 30px 23px !important; }
      .bs-main { width: calc(100% - 250px) !important; margin-left: 250px !important; }
      .bs-content, .bs-main > main:not(.bs-book-detail-page), .bs-book-detail-page, .bs-scrap-detail-page > main {
        width: min(1020px, 100%) !important; max-width: 1020px !important; padding: 50px 48px 90px 52px !important;
      }
      .bs-brand-title { font-size: 50pt !important; line-height: .88 !important; letter-spacing: -.09em !important; }
      .bs-sidebar .bs-nav button { min-height: 44px !important; height: 44px !important; font-size: 17px !important; }
      .bs-nav-count { min-width: 20px !important; height: 20px !important; font-size: 12px !important; }
      .bs-side-bottom, .bs-profile-name { font-size: 14px !important; }
      .bs-h1, .bs-page-head .bs-h1 { font-size: 38px !important; line-height: 1.2 !important; }
      .bs-h3, .bs-book-detail-section h3, .bs-book-community-panel h3, .bs-book-rating-heading { font-size: 20px !important; }
      .bs-main button:not(.bs-pagination button):not(.bs-nav button):not(.bs-top-nav button):not(.bs-personal-book-card):not(.bs-scrapbook-card):not(.bs-book-card):not(.bs-delete-x):not(.bs-rating-star-button):not(.bs-mobile-drawer-launcher):not(.bs-mobile-drawer-backdrop):not(.bs-mobile-menu-toggle):not(.bs-search-clear):not(.bs-rating-comment-edit):not(.bs-rating-comment-save):not(.bs-rating-comment-cancel):not(.bs-rating-comment-input):not(.bs-note-action):not(.bs-note-action-primary):not(.bs-profile-settings):not(.bs-logout-icon):not([class*="underline"]):not(.bs-btn-primary):not(.bs-filter-btn):not([aria-pressed="true"]),
      .bs-main button.bs-btn-primary, .bs-main button[aria-pressed="true"]:not(.bs-nav button):not(.bs-top-nav button):not(.bs-filter-btn):not(.bs-rating-star-button) {
        font-size: 14px !important; line-height: 1.2 !important;
      }
      .bs-main input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), .bs-main textarea, .bs-main select, .bs-main .bs-search-wrap .bs-search { font-size: 15px !important; }
      .bs-filter-btn { height: 36px !important; min-height: 36px !important; font-size: 14px !important; padding: 0 10px !important; }
      .bs-shelf-count, .bs-scrapbook-count { font-size: 14px !important; }
      .bs-book-card h3.bs-book-title, .bs-record-title, .bs-personal-book-title, .bs-scrapbook-title { font-size: 19px !important; }
      .bs-book-card .bs-book-author, .bs-personal-book-author, .bs-record-excerpt, .bs-book-card-quote, .bs-scrapbook-excerpt { font-size: 14px !important; }
      .bs-record-meta, .bs-scrapbook-source, .bs-scrapbook-meta, .bs-book-reader, .bs-reader-name, .bs-personal-book-date { font-size: 12px !important; }
      .bs-book-detail-hero h2 { font-size: 35px !important; line-height: 1.25 !important; }
      .bs-quote-text, .bs-review-body, .bs-prose .ProseMirror { font-size: 16px !important; }
      .bs-quote-comment, .bs-comment-text, .bs-note-record { font-size: 15px !important; }
      .bs-shelf-toolbar { border-bottom: 0 !important; padding-bottom: 0 !important; }
      .bs-book-rating-row { display: flex !important; justify-content: flex-start !important; gap: 12px !important; min-height: 50px !important; }
      .bs-book-rating-name { flex: 0 0 auto !important; max-width: 200px !important; font-size: 15px !important; }
      .bs-book-rating-row strong { display: none !important; }
      .bs-rating-input { gap: 4px !important; }
      .bs-rating-star-button { display: block !important; padding: 0 !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; }
      .bs-rating-value { display: none !important; }
      .bs-note-record { display: block !important; padding: 16px 0 !important; border-bottom: 1px solid #d4d4d4 !important; }
      .bs-note-record-quote { margin: 0 0 8px !important; padding-left: 12px !important; border-left: 3px solid #b0b0b0 !important; font-size: 15px !important; font-weight: 650 !important; line-height: 1.65 !important; }
      .bs-note-record-content { margin-left: 15px !important; color: #555 !important; font-size: 15px !important; line-height: 1.7 !important; }
      .bs-mobile-drawer-launcher { display: none !important; }
      .bs-mobile-drawer-launcher.is-open { display: none !important; }
      .bs-mobile-bottom-nav { display: none !important; }
      @media (max-width: 1200px) and (min-width: 721px) {
        .bs-sidebar { width: 230px !important; min-width: 230px !important; }
        .bs-main { width: calc(100% - 230px) !important; margin-left: 230px !important; }
        .bs-content, .bs-main > main:not(.bs-book-detail-page), .bs-book-detail-page, .bs-scrap-detail-page > main { padding: 40px 28px 70px !important; }
        .bs-brand-title { font-size: 42pt !important; }
        .bs-sidebar .bs-nav button { font-size: 16px !important; }
      }
      @media (max-width: 720px) {
        .bs-main { width: 100% !important; margin-left: 0 !important; }
        .bs-sidebar { width: min(300px, 86vw) !important; min-width: 0 !important; padding: 26px 22px !important; }
        .bs-brand-title { font-size: 50pt !important; }
        .bs-sidebar .bs-nav button { min-height: 46px !important; height: 46px !important; font-size: 17px !important; }
        .bs-mobile-drawer-launcher, .bs-mobile-drawer-launcher.is-open {
          display: inline-flex !important; position: fixed !important; top: 18px !important; left: 0 !important; right: auto !important;
          width: 38px !important; min-width: 38px !important; height: auto !important; min-height: 0 !important;
          padding: 12px 7px !important; background: #f1f1f1 !important; border: 1px solid #d4d4d4 !important; border-left: 0 !important;
          border-radius: 0 3px 3px 0 !important; color: #111 !important; z-index: 45 !important;
        }
        .bs-mobile-drawer-launcher.is-open { display: none !important; }
        .bs-vertical-wordmark { writing-mode: vertical-rl !important; text-orientation: upright !important; font-size: 15px !important; font-weight: 900 !important; line-height: 1.15 !important; letter-spacing: .08em !important; }
        .bs-mobile-menu-toggle { display: inline-flex !important; width: 36px !important; min-width: 36px !important; height: 36px !important; min-height: 36px !important; }
        .bs-content, .bs-main > main:not(.bs-book-detail-page), .bs-book-detail-page, .bs-scrap-detail-page > main {
          width: 100% !important; max-width: none !important; min-height: 100vh !important; padding: 36px 18px 72px 58px !important;
        }
        .bs-h1, .bs-page-head .bs-h1 { font-size: 32px !important; }
        .bs-book-detail-hero h2 { font-size: 27px !important; }
        .bs-book-card h3.bs-book-title, .bs-record-title, .bs-personal-book-title, .bs-scrapbook-title { font-size: 17px !important; }
        .bs-book-card .bs-book-author, .bs-personal-book-author, .bs-record-excerpt, .bs-book-card-quote, .bs-scrapbook-excerpt { font-size: 13px !important; }
        .bs-book-rating-row { gap: 8px !important; }
        .bs-book-rating-name { max-width: 110px !important; font-size: 14px !important; }
        .bs-rating-star-button { flex: 0 0 auto !important; }
      }

      /* Shared header navigation: prominent main tabs, quieter sidebar links. */
      .bs-desktop-topbar { display: flex !important; position: sticky !important; top: 0 !important; z-index: 18 !important; width: 100% !important; min-height: 62px !important; align-items: stretch !important; padding: 0 52px !important; background: rgba(247,247,247,.97) !important; border-bottom: 1px solid #d4d4d4 !important; }
      .bs-top-nav { display: flex !important; align-items: stretch !important; gap: 26px !important; margin: 0 !important; padding: 0 !important; }
      .bs-main .bs-top-nav button { display: inline-flex !important; width: auto !important; min-width: 0 !important; height: 62px !important; min-height: 62px !important; max-height: 62px !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 3px !important; color: #666 !important; background: transparent !important; border: 0 !important; border-bottom: 3px solid transparent !important; border-radius: 0 !important; box-shadow: none !important; font-family: var(--sans) !important; font-size: 21px !important; font-weight: 550 !important; letter-spacing: 0 !important; line-height: 1 !important; white-space: nowrap !important; }
      .bs-main .bs-top-nav button:hover { color: #111 !important; background: transparent !important; border-bottom-color: #bdbdbd !important; }
      .bs-main .bs-top-nav button.bs-active { color: #111 !important; background: transparent !important; border-bottom-color: #111 !important; font-weight: 750 !important; }
      .bs-main .bs-top-nav .bs-nav-count { display: inline-grid !important; min-width: 20px !important; width: auto !important; height: 20px !important; margin-left: 8px !important; padding: 0 4px !important; border: 0 !important; background: #171717 !important; color: #fff !important; font-size: 12px !important; }
      .bs-mobile-topbar { display: none !important; }
      .bs-mobile-topbar-trigger { display: none !important; }
      .bs-sidebar .bs-nav button { font-size: 15px !important; }

      /* Reduce general text slightly while retaining the requested emphasis. */
      body { font-size: 15px !important; }
      .bs-main .text-xs, .bs-main small, .bs-record-meta, .bs-scrapbook-source, .bs-scrapbook-meta { font-size: 12px !important; }
      .bs-main .text-sm { font-size: 14px !important; }
      .bs-main .text-base { font-size: 16px !important; }
      .bs-h1, .bs-page-head .bs-h1 { font-size: 37px !important; }
      .bs-book-card h3.bs-book-title, .bs-record-title, .bs-personal-book-title, .bs-scrapbook-title { font-size: 18px !important; }
      .bs-book-card .bs-book-author, .bs-personal-book-author, .bs-record-excerpt, .bs-scrapbook-excerpt { font-size: 13px !important; }

      /* Book rows: bigger covers, tighter title/byline spacing and a stable quote slot. */
      .bs-book-card { min-height: 166px !important; padding: 16px 1px !important; }
      .bs-book-card-main { position: static !important; grid-template-columns: 90px minmax(0,1fr) !important; gap: 20px !important; }
      .bs-book-card-cover { width: 90px !important; min-width: 90px !important; }
      .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img { width: 90px !important; min-width: 90px !important; height: 132px !important; }
      .bs-book-card .bs-cover-img { object-fit: cover !important; }
      .bs-book-card-info { min-height: 132px !important; padding-right: 54px !important; justify-content: flex-start !important; }
      .bs-book-card h3.bs-book-title { line-height: 1.24 !important; }
      .bs-book-author-row { display: flex !important; min-width: 0 !important; flex-wrap: wrap !important; align-items: baseline !important; gap: 0 9px !important; margin-top: 2px !important; }
      .bs-book-card .bs-book-author { margin: 0 !important; line-height: 1.28 !important; }
      .bs-series-count { display: inline !important; margin: 0 !important; color: #737373 !important; font-size: 13px !important; font-weight: 400 !important; line-height: 1.28 !important; white-space: nowrap !important; }
      .bs-book-card-quote { display: -webkit-box !important; width: 100% !important; max-width: 700px !important; min-height: 2.8em !important; margin: 8px 0 0 !important; font-size: 13px !important; line-height: 1.4 !important; -webkit-box-orient: vertical !important; -webkit-line-clamp: 2 !important; overflow: hidden !important; }
      .bs-book-card-readers { position: absolute !important; top: 12px !important; right: 2px !important; z-index: 2 !important; display: flex !important; flex-wrap: nowrap !important; align-items: center !important; justify-content: flex-end !important; gap: 4px !important; max-width: 130px !important; margin: 0 !important; padding: 0 !important; }
      .bs-book-card-readers .bs-book-reader { display: inline-flex !important; gap: 0 !important; flex: 0 0 auto !important; }
      .bs-book-card-readers .bs-reader-name { display: none !important; }

      /* Annotation list: icon first, editable text second, no quoted excerpt. */
      .bs-note-record { padding: 13px 0 !important; }
      .bs-note-record-row { display: grid !important; grid-template-columns: 20px minmax(0,1fr) auto !important; align-items: start !important; gap: 9px !important; }
      .bs-note-icon { display: inline-flex !important; align-items: flex-start !important; justify-content: center !important; padding-top: 1px !important; color: #777 !important; font-size: 18px !important; line-height: 1.4 !important; }
      .bs-note-record-content { min-width: 0 !important; margin: 0 !important; color: #333 !important; font-size: 15px !important; line-height: 1.6 !important; }
      .bs-note-record-actions, .bs-note-edit-actions { display: inline-flex !important; align-items: center !important; justify-content: flex-end !important; gap: 7px !important; }
      .bs-note-action { min-width: 28px !important; min-height: 28px !important; padding: 2px 5px !important; color: #737373 !important; background: transparent !important; border: 0 !important; border-radius: 2px !important; box-shadow: none !important; font-size: 12px !important; }
      .bs-note-action:hover { color: #111 !important; background: #eee !important; }
      .bs-note-action-primary { min-height: 30px !important; padding: 0 10px !important; color: #fff !important; background: #171717 !important; border: 1px solid #171717 !important; border-radius: 2px !important; font-size: 12px !important; }
      .bs-note-edit-form { display: grid !important; gap: 8px !important; }
      .bs-note-edit-input { width: 100% !important; min-width: 0 !important; padding: 9px 10px !important; border: 1px solid #d4d4d4 !important; background: #fff !important; color: #111 !important; font: inherit !important; font-size: 14px !important; line-height: 1.5 !important; resize: vertical !important; }

      @media (max-width: 1200px) and (min-width: 721px) {
        .bs-desktop-topbar { padding-left: 28px !important; }
        .bs-book-card-main { grid-template-columns: 86px minmax(0,1fr) !important; gap: 16px !important; }
        .bs-book-card-cover, .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img { width: 86px !important; min-width: 86px !important; height: 124px !important; }
      }
      @media (max-width: 720px) {
        .bs-desktop-topbar { display: none !important; }
        .bs-mobile-topbar { position: sticky !important; top: 0 !important; z-index: 22 !important; display: flex !important; width: 100% !important; min-height: 50px !important; align-items: center !important; justify-content: flex-start !important; padding: 0 18px !important; background: rgba(247,247,247,.98) !important; border-bottom: 1px solid #d4d4d4 !important; }
        .bs-mobile-topbar-trigger { display: inline-flex !important; min-width: 0 !important; min-height: 44px !important; align-items: center !important; justify-content: flex-start !important; padding: 0 !important; color: #111 !important; background: transparent !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; font-family: var(--sans) !important; font-size: 19px !important; font-weight: 800 !important; letter-spacing: -.04em !important; line-height: 1 !important; }
        .bs-mobile-drawer-launcher { display: none !important; }
        .bs-sidebar .bs-nav button { min-height: 42px !important; height: 42px !important; font-size: 15px !important; }
        .bs-content, .bs-main > main:not(.bs-book-detail-page), .bs-book-detail-page, .bs-scrap-detail-page > main { padding-top: 28px !important; padding-left: 18px !important; padding-right: 18px !important; }
        .bs-main { overflow: visible !important; }
        .bs-book-card { min-height: 145px !important; padding: 13px 1px !important; }
        .bs-book-card-main { grid-template-columns: 70px minmax(0,1fr) !important; gap: 13px !important; }
        .bs-book-card-cover, .bs-book-card .bs-book-cover, .bs-book-card .bs-cover-img { width: 70px !important; min-width: 70px !important; height: 104px !important; }
        .bs-book-card-info { min-height: 104px !important; padding-right: 46px !important; }
        .bs-book-card h3.bs-book-title { font-size: 17px !important; line-height: 1.24 !important; }
        .bs-book-card .bs-book-author, .bs-series-count { font-size: 12px !important; }
        .bs-book-card-quote { min-height: 2.65em !important; max-width: 700px !important; font-size: 12px !important; line-height: 1.35 !important; margin-top: 6px !important; }
        .bs-book-card-readers { top: 9px !important; right: 1px !important; max-width: 100px !important; gap: 3px !important; }
      }


      /* Stable hover/selection styling and compact navigation. */
      .bs-sidebar { width: 218px !important; min-width: 218px !important; padding-left: 17px !important; padding-right: 17px !important; }
      .bs-main { width: calc(100% - 218px) !important; margin-left: 218px !important; }
      .bs-sidebar .bs-nav { gap: 2px !important; }
      .bs-sidebar .bs-nav button,
      .bs-sidebar .bs-nav button:hover,
      .bs-sidebar .bs-nav button:focus,
      .bs-sidebar .bs-nav button:focus-visible,
      .bs-sidebar .bs-nav button.bs-active {
        border-color: transparent !important; outline: none !important; box-shadow: none !important;
        transform: none !important; font-size: 15px !important; transition: background-color .15s ease, color .15s ease !important;
      }
      .bs-sidebar .bs-nav button:hover { background: #eaeaea !important; }
      .bs-sidebar .bs-nav button.bs-active { background: #e5e5e5 !important; }
      .bs-sidebar .bs-nav-count, .bs-main .bs-top-nav .bs-nav-count { display: none !important; }
      .bs-main .bs-top-nav button:hover,
      .bs-main .bs-top-nav button:focus,
      .bs-main .bs-top-nav button:focus-visible,
      .bs-main .bs-top-nav button.bs-active { outline: none !important; box-shadow: none !important; transform: none !important; font-size: 21px !important; }
      .bs-main .bs-top-nav button:hover { border-left-color: transparent !important; border-right-color: transparent !important; }
      .bs-main button:hover, .bs-main a:hover, .bs-main [role="button"]:hover { transform: none !important; }
      .bs-main button.bs-btn-primary, .bs-main button[aria-pressed="true"]:not(.bs-nav button):not(.bs-top-nav button):not(.bs-filter-btn):not(.bs-rating-star-button) { border-color: transparent !important; }
      .bs-main button:not(.bs-top-nav button):not(.bs-nav button):not(.bs-rating-star-button):not(.bs-delete-x):hover { border-color: transparent !important; }
      .bs-book-card:hover .bs-book-title, .bs-record-row:hover .bs-record-title,
      .bs-personal-book-card:hover .bs-personal-book-title, .bs-scrapbook-card:hover .bs-scrapbook-title {
        font-size: 19px !important; transform: none !important; text-decoration: none !important;
      }
      .bs-book-card-info { padding-top: 8px !important; }
      .bs-book-card-readers { right: 14px !important; }
      .bs-book-card h3.bs-book-title, .bs-record-title, .bs-personal-book-title, .bs-scrapbook-title { font-size: 19px !important; }
      .bs-main .bs-filter-btn:hover, .bs-main .bs-filter-btn.bs-active { border-color: transparent !important; outline: none !important; box-shadow: none !important; }

      /* Quote/comments: tighter spacing, larger comments, no leading rule. */
      .bs-book-detail-section .bs-quote-list { margin-top: 5px !important; border-top: 0 !important; }
      .bs-book-detail-section .bs-quote-row { padding-top: 12px !important; padding-bottom: 12px !important; }
      .bs-quote-comments { gap: 5px !important; margin: 6px 0 0 12px !important; padding-left: 0 !important; border-left: 0 !important; }
      .bs-quote-comment-row, .bs-quote-comment-row > div, .bs-quote-comment-row .ProseMirror, .bs-quote-comment-row .whitespace-pre-line { font-size: 14px !important; line-height: 1.55 !important; }
      .bs-quote-comment-form { margin-top: 5px !important; }
      .bs-delete-x:hover { color: #cfa5a5 !important; border-color: transparent !important; background: transparent !important; }

      /* Rating row with a short editable comment. */
      .bs-book-rating-row { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 6px 12px !important; min-height: 50px !important; padding: 7px 0 !important; }
      .bs-book-rating-name { flex: 0 0 auto !important; max-width: 180px !important; font-size: 15px !important; font-weight: 750 !important; }
      .bs-book-rating-main { display: flex !important; flex: 1 1 260px !important; min-width: 0 !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; }
      .bs-rating-comment-text { min-width: 0 !important; color: #555 !important; font-size: 14px !important; line-height: 1.45 !important; overflow-wrap: anywhere !important; }
      .bs-rating-comment-actions { display: inline-flex !important; flex: 0 0 auto !important; align-items: center !important; gap: 5px !important; }
      .bs-rating-comment-edit { display: inline-flex !important; width: 24px !important; min-width: 24px !important; height: 24px !important; min-height: 24px !important; align-items: center !important; justify-content: center !important; padding: 0 !important; color: #777 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; font-size: 17px !important; line-height: 1 !important; }
      .bs-rating-comment-edit:hover { color: #111 !important; border-color: transparent !important; background: transparent !important; }
      .bs-rating-comment-form { display: inline-flex !important; flex: 1 1 260px !important; min-width: 220px !important; align-items: center !important; flex-wrap: wrap !important; gap: 5px !important; margin: 0 !important; padding: 0 !important; border: 0 !important; }
      .bs-rating-comment-input { width: min(100%, 360px) !important; min-width: 140px !important; flex: 1 1 140px !important; height: 32px !important; min-height: 32px !important; padding: 0 8px !important; color: #111 !important; background: #fff !important; border: 1px solid #d4d4d4 !important; border-radius: 2px !important; font: inherit !important; font-size: 13px !important; }
      .bs-rating-comment-save, .bs-rating-comment-cancel { display: inline-flex !important; height: 30px !important; min-height: 30px !important; align-items: center !important; justify-content: center !important; padding: 0 8px !important; color: #333 !important; background: transparent !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; font-size: 12px !important; }
      .bs-rating-comment-save:hover, .bs-rating-comment-cancel:hover { background: #eee !important; border-color: transparent !important; }
      .bs-note-icon { width: auto !important; min-width: 20px !important; font-size: 13px !important; font-weight: 650 !important; white-space: nowrap !important; }
      .bs-note-action { border: 0 !important; outline: none !important; }

      @media (max-width: 1200px) and (min-width: 721px) {
        .bs-sidebar { width: 218px !important; min-width: 218px !important; padding-left: 17px !important; padding-right: 17px !important; }
        .bs-main { width: calc(100% - 218px) !important; margin-left: 218px !important; }
        .bs-book-card h3.bs-book-title, .bs-record-title, .bs-personal-book-title, .bs-scrapbook-title { font-size: 19px !important; }
      }
      @media (max-width: 720px) {
        .bs-sidebar { width: min(280px, 84vw) !important; min-width: 0 !important; padding-left: 18px !important; padding-right: 18px !important; }
        .bs-main { width: 100% !important; margin-left: 0 !important; }
        .bs-sidebar .bs-nav { gap: 2px !important; }
        .bs-sidebar .bs-nav button, .bs-sidebar .bs-nav button:hover, .bs-sidebar .bs-nav button.bs-active { min-height: 42px !important; height: 42px !important; font-size: 15px !important; border-color: transparent !important; }
        .bs-book-card-info { padding-top: 7px !important; }
        .bs-book-card-readers { right: 10px !important; }
        .bs-book-card h3.bs-book-title, .bs-record-title, .bs-personal-book-title, .bs-scrapbook-title { font-size: 18px !important; }
        .bs-book-card:hover .bs-book-title, .bs-record-row:hover .bs-record-title, .bs-personal-book-card:hover .bs-personal-book-title, .bs-scrapbook-card:hover .bs-scrapbook-title { font-size: 18px !important; }
        .bs-rating-comment-form { min-width: 100% !important; }
        .bs-book-rating-name { font-size: 14px !important; }
        .bs-quote-comments { margin-left: 4px !important; }
        .bs-quote-comment-row, .bs-quote-comment-row > div, .bs-quote-comment-row .whitespace-pre-line { font-size: 13px !important; }
      }


      /* Final fixes requested: stable hover, topbar only on mobile, pagination and tidy notes. */
      .bs-desktop-topbar { display: none !important; }
      .bs-sidebar .bs-nav-count, .bs-top-nav .bs-nav-count { display: none !important; }
      .bs-book-rating-row strong.bs-book-rating-name { display: inline-flex !important; visibility: visible !important; flex: 0 0 auto !important; align-items: center !important; }

      .bs-book-card h3.bs-book-title,
      .bs-book-card h3.bs-book-title:hover,
      .bs-record-title, .bs-record-row:hover .bs-record-title,
      .bs-personal-book-title, .bs-personal-book-card:hover .bs-personal-book-title,
      .bs-scrapbook-title, .bs-scrapbook-card:hover .bs-scrapbook-title {
        font-size: 19px !important;
        line-height: 1.24 !important;
        letter-spacing: inherit !important;
        font-stretch: normal !important;
        transform: none !important;
        scale: none !important;
        text-decoration: none !important;
        transition: none !important;
      }
      .bs-main button.bs-personal-book-card,
      .bs-main button.bs-personal-book-card:hover,
      .bs-main button.bs-personal-book-card:focus,
      .bs-main button.bs-personal-book-card:hover:not(.bs-top-nav button):not(.bs-nav button):not(.bs-rating-star-button):not(.bs-delete-x) {
        border-top: 0 !important;
        border-left: 0 !important;
        border-right: 0 !important;
        border-bottom: 1px solid #d4d4d4 !important;
        border-bottom-color: #d4d4d4 !important;
      }

      .bs-rating-comment-edit {
        width: 20px !important; min-width: 20px !important;
        height: 24px !important; min-height: 24px !important;
        padding: 0 !important; color: #858585 !important;
        border: 0 !important; border-radius: 0 !important;
        background: transparent !important; box-shadow: none !important;
        font-size: 12px !important; line-height: 1 !important;
      }
      .bs-rating-comment-edit svg { display: block !important; width: 12px !important; height: 12px !important; }
      .bs-rating-comment-edit:hover { color: #858585 !important; background: transparent !important; border-color: transparent !important; }

      .bs-note-record { padding: 7px 0 !important; border-bottom: 1px solid #e4e4e4 !important; }
      .bs-note-record:last-child { border-bottom: 0 !important; }
      .bs-note-record-row { gap: 6px !important; }
      .bs-note-record-content { line-height: 1.45 !important; }

      .bs-pagination {
        display: flex !important; align-items: center !important; justify-content: center !important;
        flex-wrap: wrap !important; gap: 5px !important; width: 100% !important; margin: 24px 0 8px !important;
      }
      .bs-main .bs-pagination button.bs-page-number,
      .bs-main .bs-pagination button.bs-page-step {
        display: inline-flex !important; align-items: center !important; justify-content: center !important;
        width: 32px !important; min-width: 32px !important; max-width: 32px !important;
        height: 32px !important; min-height: 32px !important; max-height: 32px !important;
        margin: 0 !important; padding: 0 !important;
        color: #555 !important; background: transparent !important;
        border: 1px solid transparent !important; border-radius: 2px !important;
        box-shadow: none !important; transform: none !important;
        font-size: 14px !important; font-weight: 500 !important; line-height: 1 !important;
        text-align: center !important; text-decoration: none !important;
      }
      .bs-main .bs-pagination button.bs-page-number:hover,
      .bs-main .bs-pagination button.bs-page-step:hover:not(:disabled) {
        color: #111 !important; background: #ededed !important; border-color: transparent !important;
      }
      .bs-main .bs-pagination button.bs-page-number.is-current {
        color: #fff !important; background: #171717 !important; border-color: #171717 !important; font-weight: 700 !important;
      }
      .bs-main .bs-pagination button.bs-page-step:disabled { color: #b5b5b5 !important; opacity: .45 !important; cursor: default !important; }
      .bs-page-ellipsis { display: inline-flex !important; min-width: 14px !important; align-items: center !important; justify-content: center !important; color: #888 !important; }

      .bs-main .bs-mobile-topbar-trigger,
      .bs-main .bs-mobile-topbar-trigger:hover,
      .bs-main .bs-mobile-topbar-trigger:focus,
      .bs-main .bs-mobile-topbar-trigger:focus-visible {
        display: none !important; width: auto !important; min-width: 0 !important;
        height: auto !important; min-height: 0 !important; max-height: none !important;
        margin: 0 !important; padding: 0 !important;
        color: #111 !important; background: transparent !important;
        border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
        font-family: var(--sans) !important; font-size: 19px !important; font-weight: 800 !important;
        letter-spacing: -.04em !important; line-height: 1 !important; text-decoration: none !important;
        transform: none !important; outline: none !important;
      }
      @media (max-width: 720px) {
        .bs-mobile-topbar { display: flex !important; }
        .bs-main .bs-mobile-topbar-trigger,
        .bs-main .bs-mobile-topbar-trigger:hover,
        .bs-main .bs-mobile-topbar-trigger:focus,
        .bs-main .bs-mobile-topbar-trigger:focus-visible {
          display: inline-flex !important; align-items: center !important; justify-content: flex-start !important;
        }
        .bs-book-card h3.bs-book-title,
        .bs-book-card h3.bs-book-title:hover,
        .bs-record-title, .bs-record-row:hover .bs-record-title,
        .bs-personal-book-title, .bs-personal-book-card:hover .bs-personal-book-title,
        .bs-scrapbook-title, .bs-scrapbook-card:hover .bs-scrapbook-title { font-size: 18px !important; }
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
    <div className="bs-rating-input flex items-center gap-1" aria-label="별점 선택">
      <div className="bs-rating-stars-input flex items-center" onMouseLeave={() => setHover(0)}>
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="relative inline-block shrink-0" style={{ width: size, height: size }}>
            <Star fill={Math.min(1, Math.max(0, shown - index))} size={size} />
            <button
              type="button"
              className="bs-rating-star-button"
              style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', padding: 0, margin: 0, border: 0, borderRadius: 0, background: 'transparent', boxShadow: 'none', zIndex: 1 }}
              aria-label={`${index + 0.5}점`}
              aria-pressed={value === index + 0.5}
              onMouseEnter={() => setHover(index + 0.5)}
              onFocus={() => setHover(index + 0.5)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(value === index + 0.5 ? 0 : index + 0.5)}
            />
            <button
              type="button"
              className="bs-rating-star-button"
              style={{ position: 'absolute', left: '50%', top: 0, width: '50%', height: '100%', padding: 0, margin: 0, border: 0, borderRadius: 0, background: 'transparent', boxShadow: 'none', zIndex: 1 }}
              aria-label={`${index + 1}점`}
              aria-pressed={value === index + 1}
              onMouseEnter={() => setHover(index + 1)}
              onFocus={() => setHover(index + 1)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(value === index + 1 ? 0 : index + 1)}
            />
          </span>
        ))}
      </div>
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
    <div className="bs-quote-list">
      {quotes.map((q) => (
        <div key={q.id} className="bs-quote-row">
          <div className="bs-quote-row-main">
            <div
              onClick={isOwner ? () => toggle(q.id) : undefined}
              className={`bs-quote-text ${isOwner ? 'bs-quote-editable' : ''}`}
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
            <div className="bs-quote-comments">
              {q.quote_comments.map((c) => (
                <div key={c.id} className="bs-quote-comment-row">
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
            <form onSubmit={(e) => submit(e, q.id)} className="bs-quote-comment-form">
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
  user_id?: string;
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
          className={noted ? 'underline decoration-[#999999] decoration-1 underline-offset-4' : undefined}
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

const PAGE_SIZE = 10;

function Pagination({
  page,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const endPage = Math.min(totalPages, startPage + 4);
  const pages: (number | 'start-gap' | 'end-gap')[] = [];
  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push('start-gap');
  }
  for (let n = startPage; n <= endPage; n += 1) pages.push(n);
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push('end-gap');
    pages.push(totalPages);
  }

  return (
    <nav className="bs-pagination" aria-label="목록 페이지">
      <button type="button" className="bs-page-step" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="이전 페이지">‹</button>
      {pages.map((item) => typeof item === 'number' ? (
        <button
          type="button"
          key={item}
          className={`bs-page-number${item === page ? ' is-current' : ''}`}
          aria-current={item === page ? 'page' : undefined}
          aria-label={`${item}페이지`}
          onClick={() => onPageChange(item)}
        >{item}</button>
      ) : (
        <span key={item} className="bs-page-ellipsis" aria-hidden="true">…</span>
      ))}
      <button type="button" className="bs-page-step" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="다음 페이지">›</button>
    </nav>
  );
}

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
  const [editingRatingCommentId, setEditingRatingCommentId] = useState<string | null>(null);
  const [ratingCommentDraft, setRatingCommentDraft] = useState('');
  const [ratingCommentSaving, setRatingCommentSaving] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const [tab, setTab] = useState<Tab>('shelf');
  const [shelfPage, setShelfPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [scrapsPage, setScrapsPage] = useState(1);
  const [minePage, setMinePage] = useState(1);
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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [noteEditSaving, setNoteEditSaving] = useState(false);
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
    setShelfPage(1);
    setReviewPage(1);
    setScrapsPage(1);
    setMinePage(1);
  }, [boardFilter, shelfFilter, personalShelfFilter, allReviews, clippings, tab]);

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
    const reviewSelect = (withJson: boolean, withRatingComment: boolean) =>
      supabase
        .from('reviews')
        .select(
          `id, user_id, book_isbn, rating, status, content, ${withRatingComment ? 'rating_comment, ' : ''}${withJson ? 'content_json, ' : ''}created_at, books(title, author, cover_url), quotes(id, content, created_at, quote_comments(id, content, created_at))`
        )
        .order('created_at', { ascending: false });
    let reviewsRes = await reviewSelect(true, true);
    if (reviewsRes.error) reviewsRes = await reviewSelect(false, true);
    if (reviewsRes.error) reviewsRes = await reviewSelect(true, false);
    if (reviewsRes.error) reviewsRes = await reviewSelect(false, false);

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
        'id, title, source, content, created_at, clip_highlights(id, start_offset, end_offset, color, created_at), clip_notes(id, user_id, start_offset, end_offset, quote_text, content, created_at)'
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
          rating_comment: typeof r.rating_comment === 'string' ? r.rating_comment : null,
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

  const handleSaveRatingComment = async (target: Review) => {
    if (!user || target.user_id !== user.id) return;
    const content = ratingCommentDraft.trim().replace(/\s+/g, ' ');
    if (content.length > 120) return alert('한 줄 코멘트는 120자 이하로 입력해 주세요.');

    setRatingCommentSaving(true);
    const { error } = await supabase
      .from('reviews')
      .update({ rating_comment: content || null } as never)
      .eq('id', target.id)
      .eq('user_id', user.id);
    setRatingCommentSaving(false);

    if (error) {
      alert(`별점 코멘트 저장 실패: ${error.message}\n\n새 컬럼이 없다면 동봉된 rating_comment_migration.sql을 Supabase SQL Editor에서 실행해 주세요.`);
      return;
    }

    setAllReviews((prev) => prev.map((r) => r.id === target.id ? { ...r, rating_comment: content || null } : r));
    setEditingRatingCommentId(null);
    setRatingCommentDraft('');
  };

  const handleDeleteRatingComment = async (target: Review) => {
    if (!user || target.user_id !== user.id) return;
    if (!confirm('별점 코멘트를 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('reviews')
      .update({ rating_comment: null } as never)
      .eq('id', target.id)
      .eq('user_id', user.id);
    if (error) {
      alert(`별점 코멘트 삭제 실패: ${error.message}\n\n새 컬럼이 없다면 동봉된 rating_comment_migration.sql을 Supabase SQL Editor에서 실행해 주세요.`);
      return;
    }

    setAllReviews((prev) => prev.map((r) => r.id === target.id ? { ...r, rating_comment: null } : r));
    setEditingRatingCommentId(null);
    setRatingCommentDraft('');
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
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    if (end <= start) return;

    if (color === 'erase') {
      // Physically remove only the selected portion of existing colored marks.
      // If the selection cuts through the middle of a mark, preserve the unselected halves.
      const overlaps = activeClip.clip_highlights.filter(
        (h) => h.color !== 'erase' && h.start_offset < end && h.end_offset > start
      );
      const updated: ClipHighlight[] = [...activeClip.clip_highlights];
      for (const h of overlaps) {
        const keepLeft = h.start_offset < start;
        const keepRight = h.end_offset > end;
        if (keepLeft && keepRight) {
          const { data: rightPart, error: insertError } = await supabase
            .from('clip_highlights')
            .insert({
              clipping_id: activeClip.id,
              user_id: user.id,
              start_offset: end,
              end_offset: h.end_offset,
              color: h.color,
            })
            .select('id, start_offset, end_offset, color, created_at')
            .single();
          if (insertError || !rightPart) return alert(`형광펜 지우기 실패: ${insertError?.message || '남은 영역을 저장하지 못했어요.'}`);
          const { error: updateError } = await supabase
            .from('clip_highlights')
            .update({ end_offset: start })
            .eq('id', h.id);
          if (updateError) {
            await supabase.from('clip_highlights').delete().eq('id', rightPart.id);
            return alert(`형광펜 지우기 실패: ${updateError.message}`);
          }
          const index = updated.findIndex((item) => item.id === h.id);
          if (index >= 0) updated[index] = { ...h, end_offset: start };
          updated.push(rightPart as ClipHighlight);
          continue;
        }

        if (keepLeft || keepRight) {
          const patch = keepLeft ? { end_offset: start } : { start_offset: end };
          const { error } = await supabase.from('clip_highlights').update(patch).eq('id', h.id);
          if (error) return alert(`형광펜 지우기 실패: ${error.message}`);
          const index = updated.findIndex((item) => item.id === h.id);
          if (index >= 0) updated[index] = { ...h, ...patch };
        } else {
          const { error } = await supabase.from('clip_highlights').delete().eq('id', h.id);
          if (error) return alert(`형광펜 지우기 실패: ${error.message}`);
          const index = updated.findIndex((item) => item.id === h.id);
          if (index >= 0) updated.splice(index, 1);
        }
      }
      setClippings((prev) => prev.map((c) => c.id === activeClip.id ? { ...c, clip_highlights: updated } : c));
      clearSelection();
      return;
    }

    const { data, error } = await supabase
      .from('clip_highlights')
      .insert({
        clipping_id: activeClip.id,
        user_id: user.id,
        start_offset: start,
        end_offset: end,
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
      .select('id, user_id, start_offset, end_offset, quote_text, content, created_at')
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

  const handleUpdateNote = async (e: React.FormEvent, noteId: string) => {
    e.preventDefault();
    if (!activeClip || !user) return;
    const content = editingNoteText.trim();
    if (!content) return alert('각주 내용을 입력해 주세요.');

    setNoteEditSaving(true);
    const { data, error } = await supabase
      .from('clip_notes')
      .update({ content })
      .eq('id', noteId)
      .eq('user_id', user.id)
      .select('id')
      .single();
    setNoteEditSaving(false);
    if (error || !data) return alert(`각주 수정 실패: ${error?.message || '수정 권한이 없거나 각주를 찾을 수 없습니다.'}`);

    setClippings((prev) =>
      prev.map((c) => c.id === activeClip.id
        ? { ...c, clip_notes: c.clip_notes.map((n) => n.id === noteId ? { ...n, content } : n) }
        : c
      )
    );
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!activeClip || !confirm('이 각주를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('clip_notes').delete().eq('id', noteId);
    if (error) return alert(`삭제 실패: ${error.message}`);
    setClippings((prev) =>
      prev.map((c) =>
        c.id === activeClip.id ? { ...c, clip_notes: c.clip_notes.filter((n) => n.id !== noteId) } : c
      )
    );
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setEditingNoteText('');
    }
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
    </div>
  );

  const header = (
    <>
      <div className="bs-desktop-topbar">
        <nav className="bs-top-nav" aria-label="상단 주 메뉴">
          {navItem('shelf', '서고')}
          {navItem('mine', '책장')}
          {navItem('scraps', '스크랩북')}
        </nav>
      </div>
      <div className="bs-mobile-topbar">
        <button
          type="button"
          className="bs-mobile-topbar-trigger"
          aria-label="사이드바 메뉴 열기"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(true)}
        >
          독서팟
        </button>
      </div>
      {mobileNavOpen && (
        <button
          type="button"
          className="bs-mobile-drawer-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside className={`bs-sidebar${mobileNavOpen ? ' bs-mobile-nav-open' : ''}`}>
        <div className="bs-brand">
          <div className="bs-brand-title">독-<br />서팟</div>
          <button
            type="button"
            className="bs-mobile-menu-toggle"
            aria-label="메뉴 닫기"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="bs-nav" aria-label="주 메뉴">
          {navItem('shelf', '서고')}
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
      <div className="bs-main">
        <GlobalStyle />
        {header}
        <main className="bs-book-detail-page max-w-[900px] mx-auto px-4 py-6 md:py-8">
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
                      {seriesEntry && (
                        <div className="bs-series-volume-tabs" aria-label="시리즈 권 선택">
                          {seriesEntry.volumes.map((v) => (
                            <ToggleButton
                              key={v.volume}
                              pressed={v.reviews.some((r) => r.id === activeReview.id)}
                              onClick={() => openVolume(v)}
                              className="bs-series-volume-button"
                            >
                              {v.label}
                            </ToggleButton>
                          ))}
                        </div>
                      )}
                      {!isOwner && <div className="mt-3"><StatusCell review={activeReview} /></div>}
                    </div>

                    {isOwner && (
                      <div className="flex flex-wrap gap-2 max-w-full">
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
                {ratingReviews.length > 0 ? (
                  ratingReviews.map((r) => {
                    const canEditRatingComment = r.id === myBookReview?.id && r.status === 'completed';
                    const isEditingRatingComment = editingRatingCommentId === r.id;
                    return (
                      <div className="bs-book-rating-row" key={r.id}>
                        <strong className="bs-book-rating-name">{profileOf(r.user_id).nickname}</strong>
                        <div className="bs-book-rating-main">
                          {canEditRatingComment ? (
                            <RatingInput
                              value={r.rating}
                              onChange={(v) => handleUpdateStatus('completed', v, r)}
                              size={20}
                            />
                          ) : (
                            <RatingDisplay value={r.rating} size={15} />
                          )}

                          {r.rating_comment && !isEditingRatingComment && (
                            <span className="bs-rating-comment-text">{r.rating_comment}</span>
                          )}

                          {canEditRatingComment && (isEditingRatingComment ? (
                            <form
                              className="bs-rating-comment-form"
                              onSubmit={(e) => { e.preventDefault(); void handleSaveRatingComment(r); }}
                            >
                              <input
                                type="text"
                                value={ratingCommentDraft}
                                maxLength={120}
                                onChange={(e) => setRatingCommentDraft(e.target.value)}
                                placeholder="별점 한 줄 코멘트"
                                aria-label="별점 한 줄 코멘트"
                                className="bs-rating-comment-input"
                              />
                              <button type="submit" disabled={ratingCommentSaving} className="bs-rating-comment-save">
                                {ratingCommentSaving ? '저장 중' : '저장'}
                              </button>
                              <button type="button" className="bs-rating-comment-cancel" onClick={() => { setEditingRatingCommentId(null); setRatingCommentDraft(''); }}>
                                취소
                              </button>
                            </form>
                          ) : (
                            <div className="bs-rating-comment-actions">
                              <button
                                type="button"
                                className="bs-rating-comment-edit"
                                aria-label={r.rating_comment ? '별점 코멘트 수정' : '별점 코멘트 추가'}
                                title={r.rating_comment ? '별점 코멘트 수정' : '별점 코멘트 추가'}
                                onClick={() => { setEditingRatingCommentId(r.id); setRatingCommentDraft(r.rating_comment || ''); }}
                              >
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                                </svg>
                              </button>
                              {r.rating_comment && (
                                <button
                                  type="button"
                                  className="bs-delete-x"
                                  aria-label="별점 코멘트 삭제"
                                  title="별점 코멘트 삭제"
                                  onClick={() => void handleDeleteRatingComment(r)}
                                >×</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="bs-book-rating-empty">아직 등록된 별점이 없어요.</p>
                )}
              </div>
            </section>

            <div className="bs-book-detail-sections">
              <div>
                {showQuotes && (
                  <section className={`bs-book-detail-section ${showReview ? 'border-b border-[#d5d7da]' : ''}`}>
                    <h3 className="text-xl font-black tracking-tight">인용문</h3>

                    <div className="mt-2">
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
      { key: 'erase', label: '지우개', color: 'transparent' },
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
          <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
            <article className="scrap-detail-article min-w-0 border border-[#d5d7da] bg-[#fafafa]">
              <section className="scrap-detail-header p-5 md:p-8 border-b border-[#d5d7da] space-y-3">
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

              {notes.length > 0 && (
                <section className="scrap-detail-content p-5 md:p-8 border-t border-[#d5d7da]">
                  <h3 className="text-xl font-black tracking-tight">
                    각주{' '}
                    <span className="text-sm font-semibold text-[#666b73]">({notes.length})</span>
                  </h3>
                  <div className="mt-3">
                    {notes.map((n, i) => (
                      <div key={n.id} id={`note-${n.id}`} className="bs-note-record">
                        {editingNoteId === n.id ? (
                          <form onSubmit={(e) => handleUpdateNote(e, n.id)} className="bs-note-edit-form">
                            <textarea
                              autoFocus
                              rows={3}
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              aria-label="각주 내용 수정"
                              className="bs-note-edit-input"
                            />
                            <div className="bs-note-edit-actions">
                              <button type="submit" disabled={noteEditSaving} className="bs-note-action-primary">
                                {noteEditSaving ? '저장 중…' : '저장'}
                              </button>
                              <button type="button" className="bs-note-action" onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }}>
                                취소
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="bs-note-record-row">
                            <span className="bs-note-icon" aria-hidden="true" title={`각주 ${i + 1}`}>{i + 1})</span>
                            <div className="bs-note-record-content">
                              <DiscordText text={n.content} className="min-w-0 leading-relaxed" />
                            </div>
                            <div className="bs-note-record-actions">
                              {n.user_id === user?.id && (
                                <button
                                  type="button"
                                  className="bs-note-action"
                                  onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.content); }}
                                  aria-label="각주 수정"
                                  title="각주 수정"
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(n.id)}
                                className="bs-delete-x"
                                aria-label="각주 삭제"
                                title="각주 삭제"
                              >×</button>
                            </div>
                          </div>
                        )}
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
    const pagedVisible = visible.slice((shelfPage - 1) * PAGE_SIZE, shelfPage * PAGE_SIZE);
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
              pagedVisible.map((e) => {
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
                        <div className="bs-book-author-row">
                          <span className="bs-book-author">{author}</span>
                          {e.type === 'series' && <span className="bs-series-count">전{e.volumes.length}권</span>}
                        </div>
                        {ratedReviews.length > 0 && (
                          <div className="bs-book-rating" aria-label={`평점 ${averageRating.toFixed(1)}점`}>
                            <span className="bs-rating-stars" aria-hidden="true">
                              {Array.from({ length: 5 }, (_, i) => (
                                <span key={i}>{i < Math.round(averageRating) ? '★' : '☆'}</span>
                              ))}
                            </span>
                            <span className="bs-rating-meta">
                              {ratedReviews.length}명
                            </span>
                          </div>
                        )}
                        <p className="bs-book-card-quote" aria-label={latestQuote ? '최근 인용문' : undefined}>
                          {latestQuote ? `“${plainText(latestQuote.quote.content)}”` : ' '}
                        </p>
                      </div>
                      {readingUsers.length > 0 && (
                        <div className="bs-book-readers bs-book-card-readers" aria-label="현재 읽는 사람">
                          {readingUsers.map((uid) => (
                            <span key={uid} className="bs-book-reader" title={nameOf(uid)} aria-label={nameOf(uid)}>
                              <Seal
                                text={profileOf(uid).seal_text}
                                color={profileOf(uid).seal_color}
                                styleType={profileOf(uid).seal_style}
                                image={profileOf(uid).seal_image}
                                size={24}
                              />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <Pagination page={shelfPage} totalItems={visible.length} onPageChange={setShelfPage} />
        </div>
      </div>
    );
  }

  if (tab === 'reviews') {
    const list = writtenAll.filter(matchesFilter);
    const pagedReviews = list.slice((reviewPage - 1) * PAGE_SIZE, reviewPage * PAGE_SIZE);
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
              pagedReviews.map(renderEntryRow)
            )}
          </div>
          <Pagination page={reviewPage} totalItems={list.length} onPageChange={setReviewPage} />
        </div>
      </div>
    );
  }

  if (tab === 'scraps') {
    const filterQ = boardFilter.trim().toLowerCase();
    const clipList = clippings.filter(
      (c) => !filterQ || `${c.title} ${c.source || ''}`.toLowerCase().includes(filterQ)
    );
    const pagedClipList = clipList.slice((scrapsPage - 1) * PAGE_SIZE, scrapsPage * PAGE_SIZE);

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
              pagedClipList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="bs-scrapbook-card"
                  onClick={() => openClip(c.id)}
                >
                  <div className="bs-scrapbook-card-main">
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
          <Pagination page={scrapsPage} totalItems={clipList.length} onPageChange={setScrapsPage} />
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
  const pagedMyBooks = myBooks.slice((minePage - 1) * PAGE_SIZE, minePage * PAGE_SIZE);
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
            pagedMyBooks.map((r) => (
              <button key={r.id} type="button" className="bs-personal-book-card" onClick={() => openReview(r)}>
                <div className="bs-personal-book-cover">
                  <BookCover title={r.books.title} author={r.books.author} src={r.books.cover_url} width={88} />
                </div>
                <div className="bs-personal-book-info">
                  <h2 className="bs-personal-book-title">{r.books.title}</h2>
                  <p className="bs-personal-book-author">{r.books.author}</p>
                  {r.status === 'completed' && r.rating > 0 && (
                    <span className="bs-personal-rating">
                      <RatingDisplay value={r.rating} size={13} />
                    </span>
                  )}
                </div>
                <div className="bs-personal-book-side">
                  <span className={`bs-personal-status bs-status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  <span className="bs-personal-book-date">등록 {new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <span className="bs-personal-book-arrow" aria-hidden="true">›</span>
              </button>
            ))
          )}
        </div>
        <Pagination page={minePage} totalItems={myBooks.length} onPageChange={setMinePage} />
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
