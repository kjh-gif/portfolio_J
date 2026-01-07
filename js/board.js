// ==========================================
// 게시판 페이지 JavaScript
// ==========================================

console.log('>>> board.js 파일 로드 시작 <<<');

// 전역 변수
let supabaseClient = null; // Supabase 클라이언트 (지연 초기화)
let cachedPosts = []; // 로드된 게시글 캐시 (속도 개선용)

// 페이지네이션 변수
const POSTS_PER_PAGE = 9; // 한 페이지당 게시글 수 (3x3 그리드)
let currentPage = 1; // 현재 페이지
let totalPages = 1; // 전체 페이지 수
let allPosts = []; // 전체 게시글 (필터링 전)

// DOMContentLoaded가 이미 발생했을 수도 있으므로 체크
if (document.readyState === 'loading') {
  console.log('>>> 문서 로딩 중 - DOMContentLoaded 이벤트를 기다립니다 <<<');
  document.addEventListener('DOMContentLoaded', initBoardPage);
} else {
  console.log('>>> 문서 이미 로드됨 - 즉시 초기화 시작 <<<');
  initBoardPage();
}

async function initBoardPage() {
  console.log('=== initBoardPage 시작 ===');

  // Supabase 클라이언트 초기화
  try {
    if (typeof initSupabaseClient === 'function') {
      supabaseClient = initSupabaseClient();
      console.log('✓ Supabase 클라이언트 초기화 완료');
    } else {
      console.error('❌ initSupabaseClient 함수를 찾을 수 없습니다!');
    }
  } catch (error) {
    console.error('❌ Supabase 초기화 실패:', error);
  }

  // UI 요소
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');

  // 게시글 목록 로드
  await loadPosts();

  // 검색 버튼 클릭
  if (searchBtn) {
    searchBtn.addEventListener('click', async function() {
      const keyword = searchInput.value.trim();
      currentPage = 1; // 검색 시 첫 페이지로 이동
      await loadPosts(keyword);
    });
  }

  // 검색 입력 엔터키
  if (searchInput) {
    searchInput.addEventListener('keypress', async function(e) {
      if (e.key === 'Enter') {
        const keyword = searchInput.value.trim();
        currentPage = 1; // 검색 시 첫 페이지로 이동
        await loadPosts(keyword);
      }
    });
  }

  // 페이지네이션 버튼 이벤트
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');

  if (prevPage) {
    prevPage.addEventListener('click', function() {
      if (currentPage > 1) {
        currentPage--;
        displayCurrentPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  if (nextPage) {
    nextPage.addEventListener('click', function() {
      if (currentPage < totalPages) {
        currentPage++;
        displayCurrentPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // 상세보기 모달 닫기
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

  // URL 해시가 있으면 해당 게시글 상세보기 열기
  const hash = window.location.hash;
  if (hash && hash.startsWith('#post-')) {
    const postId = hash.replace('#post-', '');
    if (postId) {
      // 페이지 로드 후 약간의 딜레이를 두고 모달 열기
      setTimeout(async () => {
        await openDetailModal(postId);
      }, 500);
    }
  }

  console.log('=== initBoardPage 완료 ===');
}

// ==========================================
// 게시글 목록 조회
// ==========================================
async function loadPosts(keyword = '') {
  try {
    let query = supabaseClient
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    // 검색어가 있으면 제목으로 필터링
    if (keyword) {
      query = query.ilike('title', `%${keyword}%`);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('Error loading posts:', error);
      alert('게시글을 불러오는데 실패했습니다.');
      return;
    }

    // 전체 게시글 저장
    allPosts = posts;
    cachedPosts = posts; // 캐시에도 저장 (속도 개선)

    // 전체 페이지 수 계산
    totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);

    // 현재 페이지가 전체 페이지 수를 초과하면 마지막 페이지로 이동
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }

    // 현재 페이지 게시글 표시
    displayCurrentPage();

  } catch (err) {
    console.error('Error:', err);
    alert('오류가 발생했습니다.');
  }
}

// ==========================================
// 현재 페이지 게시글 표시
// ==========================================
function displayCurrentPage() {
  // 현재 페이지에 해당하는 게시글만 추출
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE;
  const postsToDisplay = allPosts.slice(startIndex, endIndex);

  displayPosts(postsToDisplay);
  updatePagination();
}

// ==========================================
// 게시글 화면에 표시
// ==========================================
function displayPosts(posts) {
  const postGrid = document.getElementById('postGrid');

  if (!posts || posts.length === 0) {
    postGrid.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">게시글이 없습니다.</p>';
    return;
  }

  postGrid.innerHTML = posts.map(post => {
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

    // 이미지 URL을 data 속성으로 저장 (프리로딩용)
    const imageUrlsJson = post.image_url ? (typeof post.image_url === 'string' ? post.image_url : JSON.stringify(post.image_url)) : '';

    // 내용 전체 표시
    const contentPreview = post.content;

    return `
      <div class="post-card" data-id="${post.id}" data-images="${escapeHtml(imageUrlsJson)}">
        ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${escapeHtml(post.title)}">` : ''}
        <div class="post-card-content">
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(contentPreview)}</p>
        </div>
      </div>
    `;
  }).join('');

  // 카드 클릭 이벤트 (상세보기/수정)
  const postCards = document.querySelectorAll('.post-card');
  postCards.forEach(card => {
    card.addEventListener('click', async function() {
      const postId = this.getAttribute('data-id');
      const imagesJson = this.getAttribute('data-images');

      // 이미지 프리로드 시작 (모달 열기 전에)
      let preloadedImages = [];
      if (imagesJson) {
        try {
          let imageUrls = [];
          try {
            imageUrls = JSON.parse(imagesJson);
          } catch {
            imageUrls = [imagesJson];
          }

          if (Array.isArray(imageUrls)) {
            preloadedImages = imageUrls.map(url => {
              const img = new Image();
              img.src = url;
              return img;
            });
          }
        } catch (e) {
          console.error('Image preload error:', e);
        }
      }

      await handlePostCardClick(postId, preloadedImages);
    });
  });
}

// ==========================================
// 게시글 카드 클릭 처리 (상세보기만)
// ==========================================
async function handlePostCardClick(postId, preloadedImages = []) {
  await openDetailModal(postId, preloadedImages);
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
// 상세보기 모달 열기
// ==========================================
async function openDetailModal(postId, preloadedImages = []) {
  const detailModal = document.getElementById('detailModal');
  const detailTitle = document.getElementById('detailTitle');
  const detailImages = document.getElementById('detailImages');
  const detailContent = document.getElementById('detailContent');

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
    let post = cachedPosts.find(p => p.id === postId);

    // 캐시에 없으면 DB에서 가져오기
    if (!post) {
      const { data, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) {
        console.error('Error fetching post:', error);
        closeDetailModalWithAnimation();
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

        // 프리로드된 이미지가 있는지 확인
        const preloadedImg = preloadedImages[index];
        let img;

        if (preloadedImg && (preloadedImg.complete || preloadedImg.naturalWidth > 0)) {
          // 이미 로드된 이미지 사용 (즉시 표시)
          img = preloadedImg;
          img.style.cssText = 'width: 100%; border-radius: 8px; display: block; opacity: 0; transition: opacity 0.3s ease;';
          img.alt = post.title;

          imgContainer.style.minHeight = 'auto';
          imgContainer.style.backgroundColor = 'transparent';
          imgContainer.appendChild(img);
          detailImages.appendChild(imgContainer);

          // 즉시 페이드 인
          setTimeout(() => {
            img.style.opacity = '1';
          }, 10);
        } else {
          // 프리로드가 안 됐거나 로딩 중인 경우 - 스켈레톤 UI 표시
          const loader = document.createElement('div');
          loader.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #999; font-size: 14px;';
          loader.textContent = '이미지 로딩 중...';
          imgContainer.appendChild(loader);

          // 이미지 생성
          img = preloadedImg || new Image();
          img.style.cssText = 'width: 100%; border-radius: 8px; display: none; opacity: 0; transition: opacity 0.3s ease;';
          img.alt = post.title;

          img.onload = () => {
            // 로딩 완료 - 스피너 제거, 이미지 표시
            loader.remove();
            img.style.display = 'block';
            imgContainer.style.minHeight = 'auto';
            imgContainer.style.backgroundColor = 'transparent';
            imgContainer.style.animation = 'none';
            // 페이드 인 효과
            setTimeout(() => {
              img.style.opacity = '1';
            }, 10);
          };

          img.onerror = () => {
            // 에러 시 스피너 제거, 에러 메시지 표시
            loader.textContent = '이미지 로드 실패';
            imgContainer.style.minHeight = '100px';
            imgContainer.style.animation = 'none';
          };

          imgContainer.appendChild(img);
          detailImages.appendChild(imgContainer);

          // 프리로드된 이미지가 없으면 로드 시작
          if (!preloadedImg) {
            img.src = url;
          }
        }
      });
    }

    // 내용 표시
    detailContent.textContent = post.content;

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

// ==========================================
// 페이지네이션 UI 업데이트
// ==========================================
function updatePagination() {
  const pagination = document.getElementById('pagination');
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');
  const pageNumbers = document.getElementById('pageNumbers');

  // 게시글이 없거나 한 페이지만 있으면 페이지네이션 숨김
  if (totalPages <= 1) {
    pagination.style.display = 'none';
    return;
  }

  pagination.style.display = 'flex';

  // 이전 버튼 활성화/비활성화
  prevPage.disabled = currentPage === 1;

  // 다음 버튼 활성화/비활성화
  nextPage.disabled = currentPage === totalPages;

  // 페이지 번호 생성 (최대 5개씩 표시)
  pageNumbers.innerHTML = '';

  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);

  // 끝 페이지가 5개 미만이면 시작 페이지 조정
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = 'page-number';
    pageBtn.textContent = i;

    if (i === currentPage) {
      pageBtn.classList.add('active');
    }

    pageBtn.addEventListener('click', function() {
      currentPage = i;
      displayCurrentPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    pageNumbers.appendChild(pageBtn);
  }
}
