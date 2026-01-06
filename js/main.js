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

// 페이지 로드 시 해시가 있으면 브라우저 자동 스크롤 방지
if (window.location.hash) {
  // 브라우저 자동 스크롤 차단
  window.scrollTo(0, 0);
}

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async function() {

  // 로그인 상태 확인 및 UI 업데이트
  await updateAuthUI();

  // 게시글 목록 로드
  await loadWorkPosts();

  // URL 해시 처리 (다른 페이지에서 이동 시)
  // 이미지 로드 완료를 handleUrlHash 내부에서 대기
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
      // 워크 카드 이미지 로드 완료 대기
      const images = document.querySelectorAll('.work-card img');
      if (images.length > 0) {
        await Promise.all(
          Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
              // 2초 타임아웃
              setTimeout(resolve, 2000);
            });
          })
        );
      }

      // 정확한 위치 계산
      const headerHeight = 80;
      const targetPosition = targetElement.offsetTop - headerHeight;

      // smooth scroll 활성화
      document.documentElement.classList.add('smooth-scroll');

      // 부드럽게 스크롤 이동
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
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

  // 1. 모달을 즉시 표시 (부드러운 애니메이션)
  detailModal.style.display = 'flex';

  // 2. 애니메이션을 위해 show 클래스 추가
  requestAnimationFrame(() => {
    detailModal.classList.add('show');
  });

  // 3. 로딩 상태 초기화
  detailTitle.textContent = '';
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

    // 이미지들 표시 (위에서 아래로) - 프로그레시브 로딩
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

      // 로딩 상태 초기화
      detailImages.innerHTML = '';

      // 각 이미지를 스켈레톤과 함께 즉시 추가 (프로그레시브 로딩)
      imageUrls.forEach((url, index) => {
        // 이미지 컨테이너 생성
        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'position: relative; width: 100%; margin-bottom: 8px; background-color: #f0f0f0; border-radius: 8px; min-height: 400px;';

        // 로딩 스피너
        const loader = document.createElement('div');
        loader.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #999; font-size: 14px;';
        loader.textContent = '이미지 로딩 중...';
        imgContainer.appendChild(loader);

        // 이미지 생성
        const img = new Image();
        img.style.cssText = 'width: 100%; border-radius: 8px; display: none; opacity: 0; transition: opacity 0.3s ease;';
        img.alt = post.title;

        img.onload = () => {
          // 로딩 완료 - 스피너 제거, 이미지 표시
          loader.remove();
          img.style.display = 'block';
          imgContainer.style.minHeight = 'auto';
          imgContainer.style.backgroundColor = 'transparent';
          imgContainer.style.animation = 'none'; // 스켈레톤 애니메이션 중지
          // 페이드 인 효과
          setTimeout(() => {
            img.style.opacity = '1';
          }, 10);
        };

        img.onerror = () => {
          // 에러 시 스피너 제거, 에러 메시지 표시
          loader.textContent = '이미지 로드 실패';
          imgContainer.style.minHeight = '100px';
          imgContainer.style.animation = 'none'; // 스켈레톤 애니메이션 중지
        };

        imgContainer.appendChild(img);
        detailImages.appendChild(imgContainer);

        // 이미지 로드 시작
        img.src = url;
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
    closeDetailModalWithAnimation();
    alert('오류가 발생했습니다.');
  }
}

// 모달 닫기 함수 (부드러운 애니메이션 + 성능 최적화)
function closeDetailModalWithAnimation() {
  const detailModal = document.getElementById('detailModal');
  const detailImages = document.getElementById('detailImages');

  // show 클래스 제거로 페이드 아웃 (즉시 실행)
  detailModal.classList.remove('show');

  // 애니메이션 완료 후 처리 (비동기)
  setTimeout(() => {
    // DOM 정리 (메모리 해제)
    if (detailImages) {
      detailImages.innerHTML = '';
    }

    // 모달 숨김
    detailModal.style.display = 'none';
  }, 200);
}

// 상세보기 모달 닫기 이벤트 (DOMContentLoaded 후)
document.addEventListener('DOMContentLoaded', function() {
  const detailModal = document.getElementById('detailModal');
  const closeDetailModal = document.getElementById('closeDetailModal');
  const btnCloseDetail = document.getElementById('btnCloseDetail');

  if (closeDetailModal) {
    closeDetailModal.addEventListener('click', closeDetailModalWithAnimation, { passive: true });
  }

  if (btnCloseDetail) {
    btnCloseDetail.addEventListener('click', closeDetailModalWithAnimation, { passive: true });
  }

  // 모달 외부 클릭 시 닫기 (성능 최적화: window 대신 모달에 직접 등록)
  if (detailModal) {
    detailModal.addEventListener('click', function(e) {
      if (e.target === detailModal) {
        closeDetailModalWithAnimation();
      }
    }, { passive: true });
  }
});
