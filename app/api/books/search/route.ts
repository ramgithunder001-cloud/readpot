import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: '검색어를 입력해 주세요.' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query)}&size=5`,
      {
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error('카카오 API 호출 실패');
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}