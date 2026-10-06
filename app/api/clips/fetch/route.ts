// 위치: app/api/clips/fetch/route.ts
// 필요한 패키지: npm i @mozilla/readability linkedom
// 환경변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (이미 쓰고 있는 값)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import dns from 'node:dns/promises';
import net from 'node:net';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 3_000_000; // 페이지는 최대 3MB까지만 읽음
const MAX_REDIRECTS = 4;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* ---------- 안전장치: 내부망 주소는 읽지 않음 ---------- */

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return false;
  }
  return true;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('올바른 링크가 아니에요.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('http 또는 https 링크만 가능해요.');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new Error('지원하지 않는 주소예요.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('지원하지 않는 주소예요.');
  } else {
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
      throw new Error('지원하지 않는 주소예요.');
    }
    const addrs = await dns.lookup(host, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
      throw new Error('지원하지 않는 주소예요.');
    }
  }
  return url;
}

/* ---------- 페이지 가져오기 ---------- */

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
    if (total >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// 오래된 한국 언론사 페이지(EUC-KR 등)도 읽을 수 있게 문자셋을 확인
function decodeHtml(bytes: Uint8Array, contentType: string): string {
  let charset = /charset=([\w-]+)/i.exec(contentType)?.[1];
  if (!charset) {
    const head = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function fetchHtml(startUrl: string): Promise<{ html: string; finalUrl: string }> {
  let url = await assertPublicUrl(startUrl);

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });

    // 이동할 때마다 새 주소도 안전한지 다시 확인
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('페이지를 불러오지 못했어요.');
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`페이지를 불러오지 못했어요 (${res.status}).`);

    const type = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(type)) throw new Error('웹 페이지 링크가 아니에요.');

    const bytes = await readLimited(res);
    return { html: decodeHtml(bytes, type), finalUrl: url.toString() };
  }
  throw new Error('이동이 너무 많은 링크예요.');
}

/* ---------- 본문 뽑기 ---------- */

function extractArticle(html: string, pageUrl: string) {
  const { document } = parseHTML(html);
  const meta = (sel: string) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';
  const ogTitle = meta('meta[property="og:title"]');
  const siteName = meta('meta[property="og:site_name"]');
  const docTitle = (document.title || '').trim();

  const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  if (!article || !article.content) return null;

  // 문단 단위로 나눠서 빈 줄로 이어 붙임
  const { document: body } = parseHTML(`<div>${article.content}</div>`);
  const blockSel = 'p, h1, h2, h3, h4, li, blockquote, pre';
  const blocks = Array.from(body.querySelectorAll(blockSel) as ArrayLike<any>)
    .filter((el) => !el.querySelector(blockSel))
    .map((el) => String(el.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 0);

  const title = (article.title || ogTitle || docTitle).trim();
  // 본문 맨 앞에 제목이 또 나오면 뺌
  if (blocks.length > 0 && (blocks[0] === title || blocks[0] === ogTitle)) blocks.shift();

  let content = blocks.join('\n\n');
  if (content.length < 100) {
    content = String(article.textContent || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  }

  return {
    title,
    site: siteName || article.siteName || new URL(pageUrl).hostname,
    content: content.slice(0, 60000),
  };
}

/* ---------- API ---------- */

export async function GET(req: NextRequest) {
  try {
    // 로그인한 사용자만 쓸 수 있게 해서, 아무나 이 서버로 다른 사이트를 읽어오지 못하게 함
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

    const target = (req.nextUrl.searchParams.get('url') || '').trim();
    if (!target) return NextResponse.json({ error: '링크를 입력해 주세요.' }, { status: 400 });

    const { html, finalUrl } = await fetchHtml(target);
    const article = extractArticle(html, finalUrl);
    if (!article || article.content.length < 100) {
      return NextResponse.json({ error: '본문을 찾지 못했어요.' }, { status: 422 });
    }

    return NextResponse.json({
      title: article.title,
      site: article.site,
      content: article.content,
      finalUrl,
    });
  } catch (e: any) {
    const message =
      e?.name === 'TimeoutError' || e?.name === 'AbortError'
        ? '페이지 응답이 너무 늦어요.'
        : e?.message === 'fetch failed'
          ? '페이지에 접속하지 못했어요.'
          : e?.message || '불러오지 못했어요.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
