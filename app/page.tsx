'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface Book {
  title: string;
  authors: string[];
  publisher: string;
  isbn: string;
  thumbnail: string;
}

interface Review {
  id: string;
  rating: number;
  quote?: string;
  content: string;
  status: 'reading' | 'completed';
  created_at: string;
  books: {
    title: string;
    author: string;
    cover_url: string;
  };
}

export default function Home() {
  // 1. Auth 관련 상태
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // 2. 독후감 작성 관련 상태
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [status, setStatus] = useState<'completed' | 'reading'>('completed');
  const [quote, setQuote] = useState('');
  const [content, setContent] = useState('');
  
  const [searchLoading, setSearchLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  // 실시간 인증 감지
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchReviews();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchReviews();
    });

    return () => subscription.unsubscribe();
  }, []);

  // 로그인/회원가입
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
    setSelectedBook(null);
  };

  // 책 검색
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

  // 독후감 저장
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !user) return;

    const isbnList = selectedBook.isbn.trim().split(' ');
    const primaryIsbn = isbnList[isbnList.length - 1] || selectedBook.isbn;

    try {
      // 1. 책 정보 DB 저장 (upsert)
      const { error: bookError } = await supabase.from('books').upsert({
        isbn: primaryIsbn,
        title: selectedBook.title,
        author: selectedBook.authors.join(', '),
        publisher: selectedBook.publisher,
        cover_url: selectedBook.thumbnail,
      });

      if (bookError) throw bookError;

      // 2. 독후감 DB 저장
      const { error: reviewError } = await supabase.from('reviews').insert({
        user_id: user.id,
        book_isbn: primaryIsbn,
        rating: status === 'reading' ? 0 : rating,
        status: status,
        quote: quote.trim() || null,
        content: content.trim(),
      });

      if (reviewError) throw reviewError;

      alert('독후감이 성공적으로 기록되었습니다! 📚');
      // 폼 초기화
      setSelectedBook(null);
      setQuote('');
      setContent('');
      setRating(5);
      setStatus('completed');
      setSearchResults([]);
      setQuery('');
      fetchReviews();
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    }
  };

  // 저장된 독후감 불러오기
  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, status, quote, content, created_at, books(title, author, cover_url)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReviews(data as any);
    }
  };

  // --- 로그인 화면 (비로그인 상태) ---
  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6 text-gray-800">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black mb-2 tracking-tight">📖 ReadPot</h1>
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

  // --- PC 중심 메인 화면 (로그인 상태) ---
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      {/* 상단 네비게이션 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">📖 ReadPot</h1>
            <span className="hidden sm:inline-block text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
              PC Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">{user.email}</span>
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 text-xs bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 2컬럼 레이아웃 */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 왼쪽 섹션: 책 검색 & 독후감 작성 (lg: 5컬럼) */}
        <section className="lg:col-span-5 space-y-6">
          
          {/* 1. 책 검색 카카오 API */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <span>🔍</span> 책 검색하기
            </h2>
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

            {/* 검색 결과 목록 */}
            {searchResults.length > 0 && (
              <div className="mt-4 divide-y divide-gray-100 max-h-72 overflow-y-auto pr-1">
                {searchResults.map((book, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={book.thumbnail} alt={book.title} className="w-11 h-16 object-cover rounded-md shadow-sm shrink-0" />
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
          </div>

          {/* 2. 독후감 및 인용구 작성 폼 */}
          {selectedBook ? (
            <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-md space-y-5">
              <div className="flex items-center justify-between border-b pb-3 border-gray-100">
                <h2 className="text-base font-bold">✍️ 기록 작성하기</h2>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  취소
                </button>
              </div>

              {/* 선택된 책 미니 정보 */}
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                <img src={selectedBook.thumbnail} alt={selectedBook.title} className="w-12 h-16 object-cover rounded-md shadow-sm" />
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{selectedBook.title}</p>
                  <p className="text-xs text-gray-500 truncate">{selectedBook.authors.join(', ')}</p>
                </div>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                {/* 읽기 상태 스위치 (완독 vs 읽는 중) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">독서 상태</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus('completed')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition ${
                        status === 'completed'
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      ✅ 완독
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('reading')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition ${
                        status === 'reading'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      📖 읽는 중...
                    </button>
                  </div>
                </div>

                {/* 5성 인터랙티브 별점 (완독 상태일 때만 노출) */}
                {status === 'completed' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">별점 평가</label>
                    <div className="flex items-center gap-1 py-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="text-2xl transition-transform hover:scale-110 focus:outline-none"
                        >
                          <span className={(hoverRating || rating) >= star ? 'text-amber-400' : 'text-gray-200'}>
                            ★
                          </span>
                        </button>
                      ))}
                      <span className="ml-2 text-sm font-bold text-gray-600">{rating}점</span>
                    </div>
                  </div>
                )}

                {/* 인용구 기능 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    💬 책 속 인상 깊은 문장 (인용구)
                  </label>
                  <input
                    type="text"
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                    placeholder="예: '바다는 마침내 도착한 마음이다.'"
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                {/* 감상평/코멘트 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    📝 독후감 / 메모
                  </label>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="책을 읽으며 느낀 생각이나 메모를 남겨주세요."
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-black text-white font-semibold text-sm rounded-xl hover:bg-gray-800 transition"
                >
                  기록 저장하기
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-300 text-center text-gray-400 text-sm">
              위 검색창에서 책을 검색하고 선택하면<br />독후감 및 인용구를 작성할 수 있습니다.
            </div>
          )}
        </section>

        {/* 오른쪽 섹션: 내 서재 / 기록 모아보기 (lg: 7컬럼) */}
        <section className="lg:col-span-7">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm min-h-[600px]">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-100">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>📚</span> 내 서재 & 독서 기록
              </h2>
              <span className="text-xs font-semibold text-gray-500">
                총 {reviews.length}권의 기록
              </span>
            </div>

            {reviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <p className="text-4xl mb-2">📖</p>
                <p className="text-sm">아직 등록된 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-4 border border-gray-100 rounded-2xl bg-gray-50 hover:border-gray-300 transition flex gap-4">
                    <img
                      src={rev.books.cover_url}
                      alt={rev.books.title}
                      className="w-16 h-24 object-cover rounded-lg shadow-sm shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-base truncate">{rev.books.title}</h3>
                          <p className="text-xs text-gray-500">{rev.books.author}</p>
                        </div>
                        {rev.status === 'reading' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full shrink-0">
                            📖 읽는 중
                          </span>
                        ) : (
                          <div className="flex items-center text-amber-400 text-sm shrink-0">
                            {'★'.repeat(rev.rating)}
                            <span className="text-gray-300">{'★'.repeat(5 - rev.rating)}</span>
                          </div>
                        )}
                      </div>

                      {/* 인용구 영역 */}
                      {rev.quote && (
                        <blockquote className="border-l-4 border-black pl-3 py-1 my-2 bg-white rounded-r-lg text-xs italic text-gray-700 font-serif">
                          "{rev.quote}"
                        </blockquote>
                      )}

                      {/* 감상평 내용 */}
                      {rev.content && (
                        <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                          {rev.content}
                        </p>
                      )}

                      <p className="text-[10px] text-gray-400 pt-1">
                        {new Date(rev.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}