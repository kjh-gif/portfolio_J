// ==========================================
// 메인 JavaScript
// ==========================================

// 브라우저 자동 스크롤 복원 방지 (해시 네비게이션 제어용)
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// 전역 변수
let cachedWorkPosts = []; // 로드된 게시글 캐시 (속도 개선용)
let isUserLoggedIn = false; // 로그인 상태 캐시 (속도 개선용)

// 페이지 로드 시 해시가 있으면 스크롤을 즉시 맨 위로 고정
if (window.location.hash) {
  // CSS scroll-behavior 완전 비활성화 (브라우저 자동 스크롤 방지)
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);

  // 부드러운 전환을 위해 페이지를 투명하게 시작
  document.body.style.opacity = '0';
}

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async function() {

  // 로그인 상태 확인 및 UI 업데이트
  await updateAuthUI();

  // 게시글 목록 로드
  await loadWorkPosts();

  // URL 해시 처리 (다른 페이지에서 이동 시)
  // 게시글 로드 후 즉시 실행하여 정확한 위치 계산
  await handleUrlHash();

  // 부드러운 스크롤 효과 (해시 처리 후 활성화)
  initSmoothScroll();

  // 스크롤 시 헤더 스타일 변경
  initHeaderScroll();

  // 작업물 카드 클릭 이벤트
  initWorkCards();

});

// ==========================================
// URL 해시 처리 (페이지 로드 시)
// ==========================================
async function handleUrlHash() {
  // URL에 해시가 있는지 확인
  const hash = window.location.hash;

  if (hash) {
    // 해시에서 # 제거
    const targetId = hash.substring(1);
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      // 약간의 지연으로 레이아웃 안정화 대기
      await new Promise(resolve => setTimeout(resolve, 50));

      // 정확한 위치 계산 및 즉시 이동
      const headerHeight = 80; // 헤더 높이
      const targetPosition = targetElement.offsetTop - headerHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: 'auto' // 즉시 이동 (끊김 없음)
      });

      // 위치 이동 후 페이드 인 효과로 부드럽게 표시
      requestAnimationFrame(() => {
        document.body.style.opacity = '1';
      });

      // 해시 네비게이션 완료 후 smooth scroll 활성화
      setTimeout(() => {
        document.documentElement.classList.add('smooth-scroll');
      }, 100);
    }
  } else {
    // 해시가 없으면 바로 smooth scroll 활성화
    document.documentElement.classList.add('smooth-scroll');
  }
}

// ==========================================
// 부드러운 스크롤 효과
// ==========================================
function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');

  links.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');

      // 빈 해시나 "#"만 있는 경우 제외
      if (href === '#' || !href) return;

      e.preventDefault();

      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        const headerHeight = 80; // 헤더 높이
        const targetPosition = targetElement.offsetTop - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ==========================================
// 스크롤 시 헤더 스타일 변경
// ==========================================
function initHeaderScroll() {
  const header = document.querySelector('header');

  window.addEventListener('scroll', function() {
    if (window.scrollY > 50) {
      header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    } else {
      header.style.boxShadow = 'none';
    }
  });
}

// ==========================================
// 작업물 카드 클릭 이벤트
// ==========================================
function initWorkCards() {
  const workCards = document.querySelectorAll('.work-card');

  workCards.forEach(card => {
    card.addEventListener('click', async function() {
      const postId = this.getAttribute('data-id');

      if (postId) {
        // 메인페이지에서 상세보기 모달 열기
        await openDetailModal(postId);
      }
    });
  });
}

// ==========================================
// 현재 섹션 감지 및 네비게이션 활성화
// ==========================================
function highlightNavigation() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('nav a');

  window.addEventListener('scroll', function() {
    let current = '';

    sections.forEach(section => {
      const sectionTop = section.offsetTop;

      if (window.scrollY >= (sectionTop - 100)) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
}

// 네비게이션 활성화 초기화
highlightNavigation();

// ==========================================
// 로그인 상태 확인 (관리자 페이지용)
// ==========================================
async function updateAuthUI() {
  // 로그인 상태 확인 (전역 변수에 캐시 - 속도 개선)
  const isLoggedIn = await checkAuth();
  isUserLoggedIn = isLoggedIn; // 전역 변수에 저장
}

// ==========================================
// 게시글 목록 로드 (메인 페이지용)
// ==========================================
async function loadWorkPosts() {
  try {
    const { data: posts, error } = await supabaseClient
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading posts:', error);
      // 메인 페이지에서는 에러를 조용히 처리
      return;
    }

    // 캐시에 저장 (속도 개선)
    cachedWorkPosts = posts;

    displayWorkPosts(posts);

  } catch (err) {
    console.error('Error:', err);
  }
}

// ==========================================
// 게시글 화면에 표시 (메인 페이지용)
// ==========================================
function displayWorkPosts(posts) {
  const workGrid = document.getElementById('workGrid');

  if (!posts || posts.length === 0) {
    workGrid.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">게시글이 없습니다.</p>';
    return;
  }

  workGrid.innerHTML = posts.map(post => {
    // 썸네일 또는 첫 번째 이미지 사용
    let thumbnailUrl = post.thumbnail_url;

    // 썸네일이 없으면 첫 번째 상세 이미지 사용
    if (!thumbnailUrl && post.image_url) {
      let imageUrls = [];
      if (typeof post.image_url === 'string') {
        try {
          imageUrls = JSON.parse(post.image_url);
        } catch {
          imageUrls = [post.image_url];
        }
      } else if (Array.isArray(post.image_url)) {
        imageUrls = post.image_url;
      }
      thumbnailUrl = imageUrls.length > 0 ? imageUrls[0] : null;
    }

    // 내용 전체 표시
    const contentPreview = post.content;

    return `
      <div class="work-card" data-id="${post.id}">
        ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${escapeHtml(post.title)}">` : ''}
        <div class="work-card-content">
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(contentPreview)}</p>
        </div>
      </div>
    `;
  }).join('');

  // 카드 클릭 이벤트 다시 초기화
  initWorkCards();
}

// ==========================================
// HTML 이스케이프 (XSS 방지)
// ==========================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// 상세보기 모달 열기 (메인 페이지용)
// ==========================================
async function openDetailModal(postId) {
  const detailModal = document.getElementById('detailModal');
  const detailTitle = document.getElementById('detailTitle');
  const detailImages = document.getElementById('detailImages');
  const detailContent = document.getElementById('detailContent');
  const detailAdminButtons = document.getElementById('detailAdminButtons');

  // 1. 모달을 즉시 표시 (속도 개선 핵심)
  detailModal.style.display = 'flex';

  // 2. 로딩 상태 표시
  detailTitle.textContent = '로딩 중...';
  detailImages.innerHTML = '';
  detailContent.textContent = '';

  try {
    // 3. 캐시에서 먼저 찾기
    let post = cachedWorkPosts.find(p => p.id === postId);

    // 캐시에 없으면 DB에서 가져오기
    if (!post) {
      const { data, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) {
        console.error('Error fetching post:', error);
        detailModal.style.display = 'none';
        alert('게시글을 불러오는데 실패했습니다.');
        return;
      }

      post = data;
    }

    // 4. 데이터로 내용 채우기
    detailTitle.textContent = post.title;

    // 이미지들 표시 (위에서 아래로)
    if (post.image_url) {
      let imageUrls = [];
      if (typeof post.image_url === 'string') {
        try {
          imageUrls = JSON.parse(post.image_url);
        } catch {
          imageUrls = [post.image_url];
        }
      } else if (Array.isArray(post.image_url)) {
        imageUrls = post.image_url;
      }

      imageUrls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = post.title;
        img.style.width = '100%';
        img.style.marginBottom = '8px';
        img.style.borderRadius = '8px';
        detailImages.appendChild(img);
      });
    }

    // 내용 표시
    detailContent.textContent = post.content;

    // 로그인 상태 확인 후 관리자 버튼 표시 여부 결정 (캐시된 값 사용)
    if (isUserLoggedIn) {
      detailAdminButtons.style.display = 'flex';

      // 수정 버튼 클릭 시 board.html로 이동
      const btnEditFromDetail = document.getElementById('btnEditFromDetail');
      btnEditFromDetail.onclick = function() {
        window.location.href = `board.html#post-${postId}`;
      };

      // 삭제 버튼 - board.html로 이동
      const btnDeleteFromDetail = document.getElementById('btnDeleteFromDetail');
      btnDeleteFromDetail.onclick = function() {
        window.location.href = `board.html#post-${postId}`;
      };
    } else {
      detailAdminButtons.style.display = 'none';
    }

  } catch (err) {
    console.error('Error:', err);
    detailModal.style.display = 'none';
    alert('오류가 발생했습니다.');
  }
}

// 상세보기 모달 닫기 이벤트 (DOMContentLoaded 후)
document.addEventListener('DOMContentLoaded', function() {
  const detailModal = document.getElementById('detailModal');
  const closeDetailModal = document.getElementById('closeDetailModal');
  const btnCloseDetail = document.getElementById('btnCloseDetail');

  if (closeDetailModal) {
    closeDetailModal.addEventListener('click', function() {
      detailModal.style.display = 'none';
    });
  }

  if (btnCloseDetail) {
    btnCloseDetail.addEventListener('click', function() {
      detailModal.style.display = 'none';
    });
  }

  // 모달 외부 클릭 시 닫기
  window.addEventListener('click', function(e) {
    if (e.target === detailModal) {
      detailModal.style.display = 'none';
    }
  });
});
