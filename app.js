/* =========================================================
   김이슬 작가 공식 홈페이지 — 데이터 중심 렌더러
   모든 콘텐츠는 data/*.json에서 불러와 이 스크립트가 화면을 만듭니다.
   JSON이 비어 있거나( [] ) 파일이 없어도 오류 없이 해당 섹션만 건너뜁니다.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 유틸 ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // *Html 필드는 소유자가 작성한 신뢰된 데이터로, <br>·<span> 같은 태그를 허용합니다.
  const raw = (s) => String(s == null ? '' : s);

  const arr = (v) => (Array.isArray(v) ? v : []);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  // JSON 문법 오류를 사람이 읽을 수 있는 위치 정보로 바꿔 줍니다.
  const jsonProblems = [];
  function diagnoseJson(text, err) {
    const msg = String(err && err.message || '');
    let pos = -1;
    let m = msg.match(/position (\d+)/);
    if (m) pos = +m[1];
    m = msg.match(/line (\d+) column (\d+)/);
    let line = null, col = null;
    if (m) { line = +m[1]; col = +m[2]; }
    else if (pos >= 0) {
      const before = text.slice(0, pos).split('\n');
      line = before.length; col = before[before.length - 1].length + 1;
    }
    let hint = '쉼표(,)나 따옴표(")가 빠지거나 남지 않았는지 확인해 보세요.';
    const lineAt = (idx) => text.slice(0, idx).split('\n').length;
    let mm;
    if ((mm = text.match(/[\u201C\u201D\u2018\u2019]/))) {
      hint = '한글 입력기의 둥근따옴표(\u201C \u201D)가 섞여 있어요. 곧은따옴표(")로 바꿔 주세요.';
      if (!line) line = lineAt(mm.index);
    } else if ((mm = text.match(/,\s*[\]}]/))) {
      hint = '마지막 항목 뒤에 쉼표(,)가 남아 있어요. 지워 주세요.';
      if (!line) line = lineAt(mm.index);
    }
    return { line, col, hint };
  }
  async function loadJSON(path) {
    try {
      const r = await fetch(path, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      const text = await r.text();
      try {
        return JSON.parse(text.replace(/^\uFEFF/, ''));
      } catch (err) {
        const d = diagnoseJson(text, err);
        jsonProblems.push({ path, ...d });
        console.warn('[data] ' + path + ' 문법 오류', err);
        return null;
      }
    } catch (e) {
      console.warn('[data] ' + path + ' 를 불러오지 못했습니다. 해당 섹션은 건너뜁니다.', e);
      return null;
    }
  }
  function showJsonProblems() {
    if (!jsonProblems.length) return;
    const box = document.createElement('div');
    box.setAttribute('style',
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:999;max-width:min(680px,94vw);' +
      "background:#2E2A26;color:#fff;border-radius:16px;padding:16px 46px 16px 20px;font-family:'Noto Sans KR',sans-serif;" +
      'font-size:.85rem;line-height:1.6;box-shadow:0 12px 30px rgba(0,0,0,.35)');
    box.innerHTML = '<b style="color:#FFD644">⚠️ 일부 내용을 불러오지 못했어요</b><br>' +
      jsonProblems.map((p) =>
        `<b>data/${esc(p.path.split('/').pop())}</b> — ` +
        (p.line ? `${p.line}번째 줄 근처에 문법 오류. ` : '문법 오류. ') + esc(p.hint)).join('<br>') +
      '<br><span style="color:#A5DFD6">👉 admin.html 관리 페이지의 [🩺 파일 검사] 탭에서 정확한 위치를 볼 수 있어요.</span>' +
      '<button style="position:absolute;top:10px;right:12px;background:none;border:0;color:#fff;font-size:1.1rem;cursor:pointer" ' +
      'onclick="this.parentNode.remove()">✕</button>';
    document.body.appendChild(box);
  }

  // 영상 주소를 채널에 맞게 처리: 유튜브/비메오/네이버TV는 화면에서 바로 재생,
  // 인스타그램 등 재생을 막는 채널은 '보러 가기' 카드로 연결합니다.
  function videoEmbed(u) {
    u = String(u || '').trim();
    if (!u) return null;
    let m = u.match(/(?:youtu\.be\/|watch\?v=|embed\/|shorts\/|live\/)([\w-]{11})/)
      || (/^[\w-]{11}$/.test(u) ? [null, u] : null);
    if (m) return { type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + m[1] };
    if ((m = u.match(/vimeo\.com\/(\d+)/))) return { type: 'iframe', src: 'https://player.vimeo.com/video/' + m[1] };
    if ((m = u.match(/tv\.naver\.com\/v\/(\d+)/))) return { type: 'iframe', src: 'https://tv.naver.com/embed/' + m[1] };
    if (!/^https?:\/\//.test(u)) return null;
    let label = '영상 보러 가기';
    if (u.includes('instagram.com')) label = '인스타그램에서 영상 보기';
    else if (u.includes('facebook.com') || u.includes('fb.watch')) label = '페이스북에서 영상 보기';
    else if (u.includes('tiktok.com')) label = '틱톡에서 영상 보기';
    else if (u.includes('blog.naver.com')) label = '네이버 블로그에서 보기';
    return { type: 'link', href: u, label };
  }

  function kwRow(list) {
    const kws = arr(list).filter(Boolean);
    if (!kws.length) return '';
    return '<div class="kw-row">' + kws.map((k) => `<span class="kw">${esc(k)}</span>`).join('') + '</div>';
  }

  function secHead(o, descStyle) {
    o = obj(o);
    let h = '';
    if (o.eyebrow) h += `<p class="sec-eyebrow">${esc(o.eyebrow)}</p>`;
    if (o.title || o.titleHtml) h += `<h2 class="sec-title">${o.titleHtml ? raw(o.titleHtml) : esc(o.title)}</h2>`;
    if (o.desc) h += `<p class="sec-desc"${descStyle ? ` style="${descStyle}"` : ''}>${esc(o.desc)}</p>`;
    return h;
  }

  // 아이디 비교: 앞뒤 공백·대소문자 차이로 연결이 끊기지 않게 함
  const normId = (v) => String(v == null ? '' : v).trim().toLowerCase();
  // 강연 카테고리 (지정이 없으면 어린이 그림책으로 취급 — 기존 데이터 호환)
  const lecCat = (lec) => normId(lec && lec.category) || 'kids';
  const DEFAULT_CATS = [
    { id: 'kids', label: '📚 어린이 그림책' },
    { id: 'creative', label: '✍️ 창작·출판' }
  ];
  function firstCatOf(site, lectures) {
    const s = obj(site.lecturesSection);
    const cats = (arr(s.categories).length ? arr(s.categories) : DEFAULT_CATS)
      .filter((cItem) => lectures.some((l) => lecCat(l) === normId(cItem.id)));
    return cats.length ? normId(cats[0].id) : lecCat(lectures[0] || {});
  }

  const THEME_CLASS = { tomato: '', mint: 'theme-mint', leaf: 'theme-leaf' };
  const DETAIL_BG = ['var(--cream)', '#fff', '#E9F6F3'];

  /* ---------- 섹션 렌더러 ---------- */

  function renderHeader(site) {
    const nav = arr(site.nav).map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('');
    const cta = obj(site.navCta);
    return `<header><div class="wrap nav">
      <a href="#" class="logo"><span class="dot"></span>${esc(site.logo || '')}</a>
      <nav class="nav-links">${nav}</nav>
      ${cta.label ? `<a href="${esc(cta.href || '#contact')}" class="nav-cta">${esc(cta.label)}</a>` : ''}
    </div></header>`;
  }

  function renderHero(site) {
    const h = obj(site.hero);
    if (!h.titleHtml && !h.lead && !h.photo) return '';
    const btns = arr(h.buttons).map((b) =>
      `<a class="btn ${b.style === 'ghost' ? 'btn-ghost' : 'btn-primary'}" href="${esc(b.href || '#')}">${esc(b.label)}</a>`).join('');
    const badges = arr(h.badgesHtml).map((b) => `<span class="badge">${raw(b)}</span>`).join('');
    return `<div class="hero"><div class="wrap">
      <div>
        ${h.eyebrow ? `<span class="eyebrow">${esc(h.eyebrow)}</span>` : ''}
        ${h.titleHtml ? `<h1>${raw(h.titleHtml)}</h1>` : ''}
        ${h.lead ? `<p class="lead">${esc(h.lead)}</p>` : ''}
        ${btns ? `<div class="btn-row">${btns}</div>` : ''}
        ${badges ? `<div class="hero-badges">${badges}</div>` : ''}
      </div>
      ${h.photo ? `<div class="hero-photo"><div class="sunburst" aria-hidden="true"></div>
        <img src="${esc(h.photo)}" alt="${esc(h.photoAlt)}"></div>` : ''}
    </div></div>`;
  }

  function renderReco(site, lectures, books) {
    const r = obj(site.reco);
    const steps = arr(r.steps);
    if (!steps.length || !lectures.length) return '';
    const stepHtml = steps.map((s, i) => `
      <div class="reco-step${i === 0 ? ' show' : ''}" data-step="${i + 1}">
        <h3 class="reco-q"><span class="reco-badge">STEP ${i + 1}</span>${esc(s.question)}</h3>
        <div class="reco-opts">${arr(s.options).map((o) =>
          `<button class="reco-opt" type="button"${o.target ? ` data-book="${esc(o.target)}"` : ''}>${esc(o.label)}</button>`).join('')}
        </div>
      </div>`).join('');
    const results = lectures.map((lec) => {
      const book = books.find((b) => b.id === lec.bookId) || {};
      return `<div class="reco-result" data-book="${esc(lec.id)}" data-cat="${esc(lecCat(lec))}">
        ${book.cover ? `<img src="${esc(book.cover)}" alt="${esc(book.coverAlt)}">` : ''}
        <div>
          <h3>${esc(((book.emoji || lec.emoji) ? (book.emoji || lec.emoji) + ' ' : '') + (book.title || lec.title || lec.id))}</h3>
          ${lec.recoWhy ? `<p class="reco-why">${esc(lec.recoWhy)}</p>` : ''}
          ${kwRow(lec.recoKeywords)}
          ${lec.recoActs ? `<p class="reco-act"><b>대표 독후활동</b> — ${esc(lec.recoActs)}</p>` : ''}
          <div class="reco-btns">
            <a class="btn btn-primary btn-sm" href="#contact">${esc(r.applyLabel || '📮 강연 신청하기')}</a>
            <a class="btn btn-ghost btn-sm" href="#prog-${esc(lec.id)}">${esc(r.moreLabel || '프로그램 자세히 보기')}</a>
          </div>
        </div>
      </div>`;
    }).join('');
    return `<section id="reco"><div class="wrap">
      ${secHead(r)}
      ${stepHtml}
      <div class="reco-results">
        <p class="reco-picked"></p>
        <div class="reco-grid">${results}</div>
        <button class="reco-restart" type="button">${esc(r.restartLabel || '↻ 처음부터 다시 고르기')}</button>
      </div>
    </div></section>`;
  }

  function renderWhy(site) {
    const w = obj(site.why);
    const cards = arr(w.cards);
    if (!cards.length) return '';
    return `<section id="why"><div class="wrap">
      ${w.heroImage ? `<img class="why-hero reveal" src="${esc(w.heroImage)}" alt="${esc(w.heroAlt)}" loading="lazy">` : ''}
      ${secHead(w)}
      <div class="why-grid">${cards.map((c) => `
        <div class="why-card reveal">
          ${c.icon ? `<div class="ico">${esc(c.icon)}</div>` : ''}
          ${c.titleHtml ? `<h3>${raw(c.titleHtml)}</h3>` : ''}
          ${c.text ? `<p>${esc(c.text)}</p>` : ''}
          ${c.photo ? `<img class="why-photo" src="${esc(c.photo)}" alt="${esc(c.photoAlt)}">` : ''}
        </div>`).join('')}
      </div>
    </div></section>`;
  }

  function renderLectures(site, lectures, books) {
    if (!lectures.length) return '';
    const s = obj(site.lecturesSection);
    const cats = (arr(s.categories).length ? arr(s.categories) : DEFAULT_CATS)
      .filter((cItem) => lectures.some((l) => lecCat(l) === normId(cItem.id)));
    const firstCat = firstCatOf(site, lectures);
    const tabsHtml = cats.length > 1 ? `<div class="cat-tabs">${cats.map((cItem, i) =>
      `<button class="cat-tab${i === 0 ? ' on' : ''}" type="button" data-cat="${esc(normId(cItem.id))}">${esc(cItem.label)}</button>`).join('')}</div>` : '';
    const filters = [];
    lectures.forEach((lec) => {
      if (lec.filterLabel) filters.push({ label: lec.filterLabel, targets: ['#lect-' + lec.id], cat: lecCat(lec) });
    });
    const firstCatTargets = lectures.filter((l) => lecCat(l) === firstCat).map((lec) => '#lect-' + lec.id);
    arr(s.commonFilters).forEach((label) => filters.push({ label, targets: firstCatTargets, cat: firstCat }));
    const filterHtml = filters.length ? `<div class="filter-row">${filters.map((f) =>
      `<button class="filter-btn${f.cat === firstCat ? '' : ' cat-hidden'}" type="button" data-cat="${esc(f.cat)}" data-target="${esc(f.targets.join(','))}">${esc(f.label)}</button>`).join('')}</div>` : '';
    const cards = lectures.map((lec) => {
      const book = books.find((b) => b.id === lec.bookId) || {};
      const cat = lecCat(lec);
      return `<div class="lect-card reveal${cat === firstCat ? '' : ' cat-hidden'}" data-cat="${esc(cat)}" id="lect-${esc(lec.id)}">
        ${book.cover ? `<img src="${esc(book.cover)}" alt="${esc(book.coverAlt)}">`
          : `<div class="lect-emoji" aria-hidden="true">${esc(book.emoji || lec.emoji || '🎤')}</div>`}
        <h3>${esc(book.title || lec.title || lec.id)}</h3>
        ${lec.oneLiner ? `<p>${esc(lec.oneLiner)}</p>` : ''}
        ${kwRow(lec.keywords)}
        <a class="lect-more" href="#prog-${esc(lec.id)}">${esc(s.moreLabel || '프로그램 자세히 보기')}</a>
      </div>`;
    }).join('');
    return `<section id="lectures"><div class="wrap">
      ${secHead(s, 'color:#5b5348')}
      ${tabsHtml}
      ${filterHtml}
      <div class="lect-grid">${cards}</div>
    </div></section>`;
  }

  function renderDetail(lec, i, books, gallery, pdfs, site, firstCat) {
    const book = books.find((b) => b.id === lec.bookId) || {};
    const s = obj(site.lecturesSection);
    const theme = THEME_CLASS[lec.theme] !== undefined ? THEME_CLASS[lec.theme] : '';
    const bg = DETAIL_BG[i % DETAIL_BG.length];

    const list = (title, items) => arr(items).length ? `
      <div class="pd-box"><h4>${title}</h4>
        <ul>${arr(items).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>` : '';

    const flow = arr(lec.flow).length ? `
      <h3 class="pd-sub">강연 진행 순서</h3>
      <ol class="flow-list">${arr(lec.flow).map((f, n) => `
        <li class="flow-step reveal"><span class="num">${n + 1}</span><b>${esc(f.title)}</b><p>${esc(f.desc)}</p></li>`).join('')}
      </ol>` : '';

    const acts = arr(lec.activities).length ? `
      <h3 class="pd-sub">${esc(lec.activitiesTitle || '독후활동')}</h3>
      <div class="act-grid">${arr(lec.activities).map((a, n) => `
        <div class="act-card reveal"><span class="num">${n + 1}</span><h4>${esc(a.title)}</h4><p>${esc(a.desc)}</p></div>`).join('')}
      </div>` : '';

    const note = obj(lec.note).title ? `
      <div class="prog-note reveal">
        <span class="medal">${esc(lec.note.icon || '🏅')}</span>
        <div><strong>${esc(lec.note.title)}</strong>${esc(lec.note.text)}</div>
      </div>` : '';

    const vids = arr(book.videos);
    const videos = vids.length ? `
      <h3 class="pd-sub">${esc(lec.videosTitle || '북트레일러')}</h3>
      <div class="video-grid${vids.length === 1 ? ' single' : ''}">${vids.map((v) => {
        const em = videoEmbed(v.url != null ? v.url : v.youtubeId);
        let inner;
        if (em && em.type === 'iframe') {
          inner = `<iframe src="${esc(em.src)}" title="${esc(v.title)}" loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>`;
        } else if (em && em.type === 'link') {
          inner = `<a class="video-link" href="${esc(em.href)}" target="_blank" rel="noopener">
              <span class="vl-play">▶</span><span class="vl-label">${esc(em.label)}</span></a>`;
        } else {
          inner = `<div class="video-ph">🎬 영상이 곧 공개됩니다</div>`;
        }
        return `<figure class="video-card reveal">
          <div class="video-frame">${inner}</div>
          <figcaption>${esc(v.title)}${v.sub ? `<small>${esc(v.sub)}</small>` : ''}</figcaption>
        </figure>`;
      }).join('')}</div>` : '';

    const shots = gallery.filter((g) => normId(g.lectureId) === normId(lec.id));
    const wall = shots.length ? `
      <h3 class="pd-sub">${esc(lec.galleryTitle || '활동 사진')}</h3>
      <div class="polaroid-wall">${shots.map((g) => `
        <figure class="polaroid reveal"><img src="${esc(g.image)}" alt="${esc(g.alt || g.caption)}" loading="lazy">
        ${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('')}
      </div>` : '';

    const myPdfs = arr(pdfs).filter((p) => normId(p.lectureId) === normId(lec.id) && p.file);
    const pdfBlock = myPdfs.length ? `
      <h3 class="pd-sub">활동지 내려받기</h3>
      <div class="pdf-row">${myPdfs.map((p) => `
        <a class="pdf-btn reveal" href="${esc(p.file)}" target="_blank" rel="noopener" download>📄 ${esc(p.title || '활동지')}</a>`).join('')}
      </div>` : '';

    const title = book.title || lec.title || lec.id;
    const emoji = book.emoji || lec.emoji || '';
    const storyText = book.story || lec.intro;
    const storyHead = book.story ? esc(book.storyIcon || '📕') + ' 책 소개' : '💬 강연 소개';
    const applyLabel = (s.applyLabelTemplate || "📮 '{title}' 강연 신청하기").replace('{title}', title);

    const cat = lecCat(lec);
    return `<section class="prog-detail ${theme}${cat === firstCat ? '' : ' cat-hidden'}" data-cat="${esc(cat)}" id="prog-${esc(lec.id)}" style="background:${bg}">
      <div class="wrap">
        ${lec.eyebrow ? `<p class="sec-eyebrow">${esc(lec.eyebrow)}</p>` : ''}
        <h2 class="sec-title">${esc((emoji ? emoji + ' ' : '') + title)}</h2>
        ${lec.tagline ? `<p class="sec-desc">${esc(lec.tagline)}</p>` : ''}
        <div class="pd-intro${book.cover ? '' : ' no-cover'}">
          ${book.cover ? `<div class="pd-cover reveal">
            <img src="${esc(book.cover)}" alt="${esc(book.coverAlt)}">
            ${book.buyUrl ? `<a class="pd-buy" href="${esc(book.buyUrl)}" target="_blank" rel="noopener">${esc(book.buyLabel || '책 보러 가기 →')}</a>` : ''}
          </div>` : ''}
          <div class="reveal">
            ${storyText ? `<div class="pd-story"><h3>${storyHead}</h3><p>${esc(storyText)}</p></div>` : ''}
            <div class="pd-cols">
              ${list('✨ 교육 효과', lec.effects)}
              ${list('🎯 추천 대상', lec.targets)}
            </div>
          </div>
        </div>
        ${flow}${acts}${note}${pdfBlock}${videos}${wall}
        <div class="pd-cta reveal"><a class="btn btn-primary" href="#contact">${esc(applyLabel)}</a></div>
      </div>
    </section>`;
  }

  function renderReviews(site, reviews) {
    if (!reviews.length) return '';
    return `<section id="reviews"><div class="wrap">
      ${secHead(obj(site.reviewsSection))}
      <div class="review-grid">${reviews.map((r) => `
        <div class="review-card reveal">
          <p>${esc(r.text)}</p>
          <div class="review-meta">${esc(r.author)}${r.context ? `<small>${esc(r.context)}</small>` : ''}</div>
        </div>`).join('')}
      </div>
    </div></section>`;
  }

  function renderNews(site, news) {
    if (!news.length) return '';
    const card = (n) => `
      ${n.date ? `<span class="news-date">${esc(n.date)}</span>` : ''}
      <h3>${esc(n.title)}</h3>
      ${n.text ? `<p>${esc(n.text)}</p>` : ''}
      ${n.url ? `<span class="news-more">자세히 보기 →</span>` : ''}`;
    return `<section id="news"><div class="wrap">
      ${secHead(obj(site.newsSection))}
      <div class="news-grid">${news.map((n) => n.url
        ? `<a class="news-card reveal" href="${esc(n.url)}" target="_blank" rel="noopener">
             <span class="news-ico">${esc(n.icon || '📰')}</span><div>${card(n)}</div></a>`
        : `<div class="news-card reveal">
             <span class="news-ico">${esc(n.icon || '📰')}</span><div>${card(n)}</div></div>`).join('')}
      </div>
    </div></section>`;
  }

  function renderAbout(site) {
    const a = obj(site.about);
    if (!a.titleHtml && !arr(a.facts).length) return '';
    return `<section id="about"><div class="wrap about-grid">
      ${a.photo ? `<div class="about-photo reveal"${a.photoSticker ? ` data-sticker="${esc(a.photoSticker)}"` : ''}>
        <img src="${esc(a.photo)}" alt="${esc(a.photoAlt)}"></div>` : ''}
      <div class="reveal">
        ${a.eyebrow ? `<p class="sec-eyebrow">${esc(a.eyebrow)}</p>` : ''}
        ${a.titleHtml ? `<h2 class="sec-title">${raw(a.titleHtml)}</h2>` : ''}
        ${a.desc ? `<p class="sec-desc" style="margin-bottom:0">${esc(a.desc)}</p>` : ''}
        ${arr(a.facts).length ? `<ul class="about-facts">${arr(a.facts).map((f) => `
          <li><span class="ico">${esc(f.icon || '⭐')}</span><span>${f.strong ? `<b>${esc(f.strong)}</b> — ` : ''}${esc(f.text)}</span></li>`).join('')}
        </ul>` : ''}
      </div>
    </div></section>`;
  }

  function renderFaq(site, faq) {
    if (!faq.length) return '';
    return `<section id="faq"><div class="wrap">
      ${secHead(obj(site.faqSection))}
      <div class="faq-list">${faq.map((f) => `
        <details class="faq-item reveal">
          <summary><span class="faq-q">Q</span>${esc(f.q)}</summary>
          <p class="faq-a">${esc(f.a)}</p>
        </details>`).join('')}
      </div>
    </div></section>`;
  }

  function renderContact(site) {
    const c = obj(site.contact);
    if (!c.titleHtml && !arr(c.contacts).length) return '';
    return `<section id="contact"><div class="wrap"><div class="cert reveal">
      ${c.label ? `<p class="cert-label">${esc(c.label)}</p>` : ''}
      ${c.titleHtml ? `<h2>${raw(c.titleHtml)}</h2>` : ''}
      ${c.desc ? `<p>${esc(c.desc)}</p>` : ''}
      ${c.ctaLabel ? `<div class="btn-row"><a class="btn btn-primary" href="${esc(c.ctaHref || '#')}">${esc(c.ctaLabel)}</a></div>` : ''}
      ${arr(c.contacts).length ? `<div class="cert-contacts">${arr(c.contacts).map((k) => `
        <a href="${esc(k.href)}"${k.external ? ' target="_blank" rel="noopener"' : ''}><span class="ci">${esc(k.icon || '🔗')}</span> ${esc(k.label)}</a>`).join('')}
      </div>` : ''}
      ${c.note ? `<small>${esc(c.note)}</small>` : ''}
    </div></div></section>`;
  }

  function renderFooter(site) {
    const f = obj(site.footer);
    if (!f.titleHtml && !f.text) return '';
    return `<footer>${f.titleHtml ? `<span class="jua">${raw(f.titleHtml)}</span>` : ''}${esc(f.text || '')}</footer>`;
  }

  /* ---------- 동작(마법사·필터·리빌) ---------- */

  function initReveal() {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  function initReco(site) {
    const reco = document.getElementById('reco');
    if (!reco) return;
    const r = obj(site.reco);
    const steps = Array.from(reco.querySelectorAll('.reco-step'));
    const results = reco.querySelector('.reco-results');
    const picked = reco.querySelector('.reco-picked');
    const state = { book: null, who: '', time: '' };
    const clean = (t) => t.replace(/[\u{2190}-\u{2BFF}\u{1F000}-\u{1FAFF}\u{FE0F}]/gu, '').trim();

    function showResults() {
      let shown = 0;
      reco.querySelectorAll('.reco-result').forEach((el) => {
        const hit = state.book === 'all' || el.dataset.book === state.book || el.dataset.cat === state.book;
        el.classList.toggle('show', hit);
        if (hit) shown++;
      });
      picked.textContent = '💡 ' + [state.who, state.time].filter(Boolean).join(' · ') + ' '
        + (shown > 1 ? (r.resultAll || '이 프로그램들을 모두 추천해요!') : (r.resultOne || '기준 추천 프로그램이에요.'));
      results.classList.add('show');
    }
    function reset() {
      state.book = null; state.who = ''; state.time = '';
      reco.querySelectorAll('.reco-opt.selected').forEach((o) => o.classList.remove('selected'));
      steps.forEach((s, i) => s.classList.toggle('show', i === 0));
      results.classList.remove('show');
      reco.querySelectorAll('.reco-result').forEach((el) => el.classList.remove('show'));
      picked.textContent = '';
    }
    reco.addEventListener('click', (e) => {
      if (e.target.closest('.reco-restart')) { reset(); return; }
      const b = e.target.closest('.reco-opt');
      if (!b) return;
      const step = b.closest('.reco-step');
      step.querySelectorAll('.reco-opt').forEach((o) => o.classList.remove('selected'));
      b.classList.add('selected');
      const n = +step.dataset.step;
      if (n === 1) { state.book = b.dataset.book || 'all'; if (steps[1]) steps[1].classList.add('show'); else showResults(); }
      else if (n === 2) { state.who = clean(b.textContent); if (steps[2]) steps[2].classList.add('show'); else showResults(); }
      else { state.time = clean(b.textContent); showResults(); }
    });
  }

  function initCatTabs() {
    const tabs = document.querySelectorAll('.cat-tab');
    if (!tabs.length) return;
    function apply(cat) {
      document.querySelectorAll('.cat-tab').forEach((t) => t.classList.toggle('on', t.dataset.cat === cat));
      document.querySelectorAll('.lect-card').forEach((card) => {
        const show = card.dataset.cat === cat;
        card.classList.toggle('cat-hidden', !show);
        if (show) {
          card.classList.add('on');
          card.style.animation = 'none';
          void card.offsetWidth;
          card.style.animation = 'rise .45s ease both';
        }
      });
      let visible = 0;
      document.querySelectorAll('.filter-btn').forEach((f) => {
        const show = f.dataset.cat === cat;
        f.classList.toggle('cat-hidden', !show);
        if (show) visible++;
      });
      const row = document.querySelector('.filter-row');
      if (row) row.style.display = visible ? '' : 'none';
      // 프로그램 상세 섹션도 선택된 탭만 표시 → 페이지 길이가 늘어나지 않음
      document.querySelectorAll('.prog-detail[data-cat]').forEach((sec) => {
        sec.classList.toggle('cat-hidden', sec.dataset.cat !== cat);
      });
    }
    tabs.forEach((t) => t.addEventListener('click', () => apply(t.dataset.cat)));
    // 숨겨진 카테고리의 프로그램으로 가는 링크를 누르면 그 탭으로 자동 전환 후 이동
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#prog-"], a[href^="#lect-"]');
      if (!a) return;
      const target = document.querySelector(a.getAttribute('href'));
      if (target && target.classList.contains('cat-hidden') && target.dataset.cat) {
        apply(target.dataset.cat);
        e.preventDefault(); // 레이아웃이 바뀌는 중이라 기본 이동은 어긋남 → 정리된 뒤 부드럽게 이동
        requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    });
  }

  function initFilter() {
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targets = btn.dataset.target.split(',')
          .map((s) => document.querySelector(s.trim())).filter(Boolean);
        if (!targets.length) return;
        document.querySelectorAll('.lect-card.flash').forEach((c) => c.classList.remove('flash'));
        targets.forEach((c) => { void c.offsetWidth; c.classList.add('flash'); });
        targets[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => targets.forEach((c) => c.classList.remove('flash')), 2400);
      });
    });
  }

  /* ---------- 조립 ---------- */
  async function main() {
    const app = document.getElementById('app');
    const [siteData, booksData, lecturesData, galleryData, newsData, reviewsData, faqData, pdfsData] =
      await Promise.all([
        loadJSON('data/site.json'),
        loadJSON('data/books.json'),
        loadJSON('data/lectures.json'),
        loadJSON('data/gallery.json'),
        loadJSON('data/news.json'),
        loadJSON('data/reviews.json'),
        loadJSON('data/faq.json'),
        loadJSON('data/pdfs.json')
      ]);

    if (!siteData) {
      app.innerHTML = `<div style="max-width:640px;margin:80px auto;padding:24px;text-align:center;
        font-family:'Jua',sans-serif;background:#fff;border-radius:22px;border:3px dashed #FF5A36">
        <p style="font-size:1.3rem;margin-bottom:10px">데이터를 불러오지 못했어요 🥲</p>
        <p style="font-family:'Noto Sans KR',sans-serif;font-size:.9rem;color:#57514a">
        data/site.json 파일을 확인해 주세요.<br>
        (컴퓨터에서 파일을 바로 열면 보안 정책 때문에 JSON을 읽을 수 없습니다.<br>
        README.md의 '내 컴퓨터에서 미리 보기'를 참고하거나, 배포된 주소에서 확인해 주세요.)</p></div>`;
      showJsonProblems();
      return;
    }

    const site = obj(siteData);
    const books = arr(booksData);
    const lectures = arr(lecturesData);
    const gallery = arr(galleryData);
    const news = arr(newsData);
    const reviews = arr(reviewsData);
    const faq = arr(faqData);
    const pdfs = arr(pdfsData);

    if (site.siteTitle) document.title = site.siteTitle;
    if (site.metaDescription) {
      const m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute('content', site.metaDescription);
    }

    // 콘텐츠가 없는 섹션의 메뉴는 자동으로 숨김
    const firstCat = firstCatOf(site, lectures);
    const details = lectures.map((lec, i) => renderDetail(lec, i, books, gallery, pdfs, site, firstCat)).join('');
    app.innerHTML = [
      renderHeader(site),
      renderHero(site),
      renderReco(site, lectures, books),
      renderWhy(site),
      renderLectures(site, lectures, books),
      details,
      renderReviews(site, reviews),
      renderNews(site, news),
      renderAbout(site),
      renderFaq(site, faq),
      renderContact(site),
      renderFooter(site)
    ].join('');

    document.querySelectorAll('.nav-links a').forEach((a) => {
      const id = (a.getAttribute('href') || '').replace('#', '');
      if (id && !document.getElementById(id)) a.remove();
    });

    initReveal();
    initReco(site);
    initCatTabs();
    initFilter();
    showJsonProblems();

    // 연결 점검: pdfs/gallery의 lectureId가 어떤 강연과도 안 맞으면 콘솔에 알려 줌
    const lecIds = lectures.map((l) => normId(l.id));
    [['pdfs.json', pdfs], ['gallery.json', gallery]].forEach(([name, list]) => {
      list.forEach((it) => {
        if (it && it.lectureId != null && !lecIds.includes(normId(it.lectureId))) {
          console.warn('[data] ' + name + '의 lectureId "' + it.lectureId +
            '" 와 일치하는 강연이 없어 화면에 표시되지 않습니다. lectures.json의 id: ' + lecIds.join(', '));
        }
      });
    });
  }

  main();
})();
