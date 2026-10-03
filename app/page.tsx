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

interface QuoteItem {
  id: string;
  content: string;
  comment_text: string | null;
  created_at: string;
}

interface Review {
  id: string;
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

/* ---------- 공통 UI 조각 ---------- */

// 프리텐다드 폰트를 전체에 적용
function FontStyle() {
  return (
    <style>{`
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
      body, body * {
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif !important;
      }
    `}</style>
  );
}

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
        className="absolute inset-0 text-gray-200"
        fill="currentColor"
      >
        <path d={STAR_PATH} />
      </svg>
      <span
        className="absolute left-0 top-0 h-full overflow-hidden text-amber-400"
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
      <span className="text-sm font-semibold text-gray-600">{value}점</span>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 focus:outline-none"
    >
      <span
        className={`relative w-10 h-6 rounded-full transition ${checked ? 'bg-amber-500' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </button>
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
  const [initialComment, setInitialComment] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // 게시판 / 상세 화면
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [boardFilter, setBoardFilter] = useState('');
  const [newQuoteInput, setNewQuoteInput] = useState('');
  const [newCommentInput, setNewCommentInput] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContentText, setEditContentText] = useState('');

  const activeReview = reviews.find((r) => r.id === activeId) ?? null;

  const fetchReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select(
        'id, rating, status, content, created_at, books(title, author, cover_url), quotes(id, content, comment_text, created_at)'
      )
      .order('created_at', { ascending: false });

    if (error) console.error('fetchReviews 에러:', error.message, error.details);

    if (!error && data) {
      const normalized = (data as any[]).map((r) => ({
        ...r,
        rating: Number(r.rating) || 0,
        quotes: (r.quotes || []).sort(
          (a: QuoteItem, b: QuoteItem) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }));
      setReviews(normalized as Review[]);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchReviews();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchReviews();
    });

    return () => subscription.unsubscribe();
  }, [fetchReviews]);

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
    setReviews([]);
    setActiveId(null);
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
          comment_text: initialComment.trim() || null,
        });
        if (quoteError) throw quoteError;
      }

      setSelectedBook(null);
      setInitialQuote('');
      setInitialComment('');
      setRating(0);
      setIsReading(false);
      setSearchResults([]);
      setQuery('');
      await fetchReviews();

      // 등록하자마자 해당 글 상세 화면으로 이동
      setActiveId(reviewData.id);
      setIsEditingContent(false);
      setEditContentText('');
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    }
  };

  // ---------- 상태 / 별점 수정 ----------
  const handleUpdateStatus = async (nextReading: boolean, nextRating: number) => {
    if (!activeReview) return;
    const nextStatus = nextReading ? 'reading' : 'completed';
    const savedRating = nextReading ? 0 : nextRating;

    // 화면 먼저 반영
    setReviews((prev) =>
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
      fetchReviews();
    }
  };

  // ---------- 인용문 ----------
  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReview || !user || !newQuoteInput.trim()) return;

    try {
      const { error } = await supabase.from('quotes').insert({
        review_id: activeReview.id,
        user_id: user.id,
        content: newQuoteInput.trim(),
        comment_text: newCommentInput.trim() || null,
      });
      if (error) throw error;
      setNewQuoteInput('');
      setNewCommentInput('');
      fetchReviews();
    } catch (err: any) {
      alert(`인용문 추가 실패: ${err.message}`);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('이 인용문을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
      if (error) throw error;
      fetchReviews();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // ---------- 독후감 ----------
  const handleSaveContentEdit = async () => {
    if (!activeReview) return;
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ content: editContentText.trim() })
        .eq('id', activeReview.id);
      if (error) throw error;
      setIsEditingContent(false);
      fetchReviews();
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
      fetchReviews();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const openReview = (rev: Review) => {
    setActiveId(rev.id);
    setIsEditingContent(false);
    setEditContentText(rev.content || '');
    setNewQuoteInput('');
    setNewCommentInput('');
    window.scrollTo({ top: 0 });
  };

  const filteredReviews = reviews.filter((r) => {
    const q = boardFilter.trim().toLowerCase();
    if (!q) return true;
    return r.books.title.toLowerCase().includes(q) || r.books.author.toLowerCase().includes(q);
  });

  // ---------- 로그인 화면 ----------
  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6 text-gray-800">
        <FontStyle />
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black mb-2 tracking-tight">ReadPot</h1>
            <p className="text-sm text-gray-500">
              {isSignUp ? '새로운 계정 생성하기' : '나만의 독후감과 인용구를 기록하세요'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자리 이상 비밀번호"
                className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-black text-white font-medium rounded-xl hover:bg-gray-800 transition text-sm disabled:bg-gray-400"
            >
              {authLoading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-gray-500 underline hover:text-black"
            >
              {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- 공통 헤더 ----------
  const header = (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
        <button onClick={() => setActiveId(null)}>
          <h1 className="text-2xl font-black tracking-tight">ReadPot</h1>
        </button>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm font-medium text-gray-600">{user.email}</span>
          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 text-xs bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );

  // ---------- 상세 화면 ----------
  if (activeReview) {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-800">
        <FontStyle />
        {header}
        <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <button onClick={() => setActiveId(null)} className="text-sm text-gray-500 hover:text-black">
            &larr; 게시판으로 돌아가기
          </button>

          {/* 책 정보 */}
          <section className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm flex gap-5 items-center">
            <img
              src={activeReview.books.cover_url || undefined}
              alt={activeReview.books.title}
              className="w-24 h-36 object-cover rounded-xl shadow-md shrink-0 bg-gray-200"
            />
            <div className="space-y-2 min-w-0">
              <span className="text-xs text-gray-400">
                등록일: {new Date(activeReview.created_at).toLocaleDateString('ko-KR')}
              </span>
              <h2 className="text-2xl font-bold">{activeReview.books.title}</h2>
              <p className="text-sm text-gray-500">{activeReview.books.author}</p>

              <div className="pt-2 space-y-3">
                <Toggle
                  checked={activeReview.status === 'reading'}
                  onChange={(v) => handleUpdateStatus(v, activeReview.rating)}
                  label="읽는 중"
                />
                {activeReview.status !== 'reading' && (
                  <RatingInput
                    value={activeReview.rating}
                    onChange={(v) => handleUpdateStatus(false, v)}
                    size={26}
                  />
                )}
              </div>
            </div>
          </section>

          {/* 인용문 */}
          <section className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold">인용문 ({activeReview.quotes?.length || 0})</h3>

            <form onSubmit={handleAddQuote} className="space-y-2">
              <textarea
                rows={2}
                value={newQuoteInput}
                onChange={(e) => setNewQuoteInput(e.target.value)}
                placeholder="마음에 남은 문장을 적어 보세요"
                className="w-full p-3 border border-gray-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-black"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCommentInput}
                  onChange={(e) => setNewCommentInput(e.target.value)}
                  placeholder="코멘트 (선택)"
                  className="flex-1 p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 shrink-0"
                >
                  추가
                </button>
              </div>
            </form>

            <div className="space-y-2 pt-1">
              {activeReview.quotes && activeReview.quotes.length > 0 ? (
                activeReview.quotes.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 bg-gray-50 border-l-4 border-black rounded-r-xl flex justify-between items-start gap-3"
                  >
                    <div className="min-w-0 space-y-2">
                      <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">
                        &ldquo;{q.content}&rdquo;
                      </p>
                      {q.comment_text && (
                        <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
                          {q.comment_text}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteQuote(q.id)}
                      className="text-gray-400 hover:text-red-500 text-xs shrink-0"
                    >
                      삭제
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 py-2">아직 추가된 인용문이 없습니다.</p>
              )}
            </div>
          </section>

          {/* 독후감 */}
          <section className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold">독후감</h3>
              {!isEditingContent && activeReview.content && (
                <button
                  onClick={() => {
                    setEditContentText(activeReview.content || '');
                    setIsEditingContent(true);
                  }}
                  className="text-xs text-gray-500 hover:text-black underline"
                >
                  수정하기
                </button>
              )}
            </div>

            {isEditingContent ? (
              <div className="space-y-2">
                <textarea
                  rows={10}
                  value={editContentText}
                  onChange={(e) => setEditContentText(e.target.value)}
                  placeholder="이 책을 읽고 느낀 점을 자유롭게 적어 보세요."
                  className="w-full p-4 border border-gray-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-black"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingContent(false)}
                    className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveContentEdit}
                    className="px-5 py-2 text-xs bg-black text-white font-medium rounded-lg"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : activeReview.content ? (
              <div className="bg-gray-50 p-5 rounded-xl text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {activeReview.content}
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditContentText('');
                  setIsEditingContent(true);
                }}
                className="w-full py-6 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-black hover:text-black transition"
              >
                독후감 추가
              </button>
            )}
          </section>

          <div className="flex justify-between items-center text-xs pb-8">
            <button
              onClick={() => handleDeleteReview(activeReview.id)}
              className="text-red-500 hover:underline"
            >
              이 책 서재에서 삭제
            </button>
            <button
              onClick={() => setActiveId(null)}
              className="px-4 py-2 bg-white border border-gray-300 font-semibold text-gray-700 rounded-xl hover:bg-gray-100"
            >
              목록으로
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ---------- 게시판 화면 ----------
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <FontStyle />
      {header}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* 책 검색해서 새 글 만들기 */}
        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
          <h2 className="text-base font-bold">책 검색해서 새 글 만들기</h2>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="책 제목 또는 저자 검색..."
              className="flex-1 p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="px-5 py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition disabled:bg-gray-400 shrink-0"
            >
              {searchLoading ? '검색 중...' : '검색'}
            </button>
          </form>

          {searchResults.length > 0 && !selectedBook && (
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto pr-1">
              {searchResults.map((book, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={book.thumbnail || undefined}
                      alt={book.title}
                      className="w-11 h-16 object-cover rounded-md shadow-sm shrink-0 bg-gray-200"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{book.title}</p>
                      <p className="text-xs text-gray-500 truncate">{book.authors.join(', ')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBook(book)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-black border border-gray-300 rounded-lg hover:bg-black hover:text-white transition shrink-0"
                  >
                    선택
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedBook && (
            <div className="border-2 border-black rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">새 책 서재에 추가</h3>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  다시 선택
                </button>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                <img
                  src={selectedBook.thumbnail || undefined}
                  alt={selectedBook.title}
                  className="w-12 h-16 object-cover rounded-md shadow-sm bg-gray-200"
                />
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{selectedBook.title}</p>
                  <p className="text-xs text-gray-500 truncate">{selectedBook.authors.join(', ')}</p>
                </div>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-5">
                <Toggle checked={isReading} onChange={setIsReading} label="읽는 중" />

                {!isReading && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">별점 평가</label>
                    <RatingInput value={rating} onChange={setRating} />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">첫 번째 인용문 (선택)</label>
                  <input
                    type="text"
                    value={initialQuote}
                    onChange={(e) => setInitialQuote(e.target.value)}
                    placeholder="인상 깊었던 문장을 입력해 보세요"
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <input
                    type="text"
                    value={initialComment}
                    onChange={(e) => setInitialComment(e.target.value)}
                    placeholder="코멘트 (선택)"
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-black text-white font-semibold text-sm rounded-xl hover:bg-gray-800 transition"
                >
                  내 서재에 등록하기
                </button>
              </form>
            </div>
          )}
        </section>

        {/* 게시판 목록 */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-bold flex items-center gap-2">
              내 서재 게시판
              <span className="text-xs font-semibold text-gray-400">총 {reviews.length}권</span>
            </h2>
            <input
              type="text"
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              placeholder="내 서재에서 찾기..."
              className="w-full sm:w-56 p-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="hidden sm:grid grid-cols-12 gap-3 px-6 py-2.5 bg-gray-50 text-[11px] font-semibold text-gray-500 border-b border-gray-100">
            <span className="col-span-5">책 제목</span>
            <span className="col-span-2">저자</span>
            <span className="col-span-2 text-center">상태 / 별점</span>
            <span className="col-span-2 text-center">인용문</span>
            <span className="col-span-1 text-right">날짜</span>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <p className="text-sm">
                {reviews.length === 0
                  ? '등록된 책이 없습니다. 위에서 책을 검색해 첫 글을 만들어 보세요.'
                  : '검색 결과가 없습니다.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredReviews.map((rev) => (
                <li
                  key={rev.id}
                  onClick={() => openReview(rev)}
                  className="grid grid-cols-12 gap-3 items-center px-6 py-4 hover:bg-gray-50 cursor-pointer transition group"
                >
                  <div className="col-span-12 sm:col-span-5 flex items-center gap-3 min-w-0">
                    <img
                      src={rev.books.cover_url || undefined}
                      alt={rev.books.title}
                      className="w-9 h-12 object-cover rounded shadow-sm shrink-0 bg-gray-200"
                    />
                    <span className="font-semibold text-sm truncate group-hover:underline">
                      {rev.books.title}
                    </span>
                  </div>
                  <span className="col-span-5 sm:col-span-2 text-xs text-gray-500 truncate">
                    {rev.books.author}
                  </span>
                  <div className="col-span-4 sm:col-span-2 flex justify-center">
                    {rev.status === 'reading' ? (
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 rounded-full">
                        읽는 중
                      </span>
                    ) : (
                      <RatingDisplay value={rev.rating} size={13} />
                    )}
                  </div>
                  <span className="col-span-3 sm:col-span-2 text-center text-xs text-gray-500">
                    인용문 {rev.quotes?.length || 0}
                  </span>
                  <span className="hidden sm:block col-span-1 text-right text-[11px] text-gray-400">
                    {new Date(rev.created_at).toLocaleDateString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
