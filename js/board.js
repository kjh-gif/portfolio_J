// ==========================================
// 게시판 페이지 JavaScript
// ==========================================

// 전역 변수
let cachedPosts = []; // 로드된 게시글 캐시 (속도 개선용)

// 페이지네이션 변수
const POSTS_PER_PAGE = 9; // 한 페이지당 게시글 수 (3x3 그리드)
let currentPage = 1; // 현재 페이지
let totalPages = 1; // 전체 페이지 수
let allPosts = []; // 전체 게시글 (필터링 전)

document.addEventListener('DOMContentLoaded', async function() {

  // UI 요소
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const writeBtn = document.getElementById('writeBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // 로그인 상태 확인 후 Write 버튼 및 로그아웃 버튼 표시
  const isLoggedIn = await checkAuth();
  if (isLoggedIn) {
    // Write 버튼 표시
    if (writeBtn) {
      writeBtn.style.display = 'inline-block';
      writeBtn.addEventListener('click', function() {
        window.location.href = 'admin.html';
      });
    }

    // 로그아웃 버튼 표시 (푸터에)
    if (logoutBtn) {
      logoutBtn.style.display = 'inline';
      logoutBtn.addEventListener('click', async function() {
        try {
          const { error } = await supabaseClient.auth.signOut();
          if (error) {
            console.error('Logout error:', error);
            alert('로그아웃에 실패했습니다.');
            return;
          }
          alert('로그아웃되었습니다.');
          window.location.reload();
        } catch (err) {
          console.error('Error:', err);
          alert('오류가 발생했습니다.');
        }
      });
    }
  }

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
    closeDetailModal.addEventListener('click', function() {
      detailModal.style.display = 'none';
    });
  }

  if (btnCloseDetail) {
    btnCloseDetail.addEventListener('click', function() {
      detailModal.style.display = 'none';
    });
  }

  // 상세보기 모달 외부 클릭 시 닫기
  window.addEventListener('click', function(e) {
    if (e.target === detailModal) {
      detailModal.style.display = 'none';
    }
  });

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

});

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

    // 내용 전체 표시
    const contentPreview = post.content;

    return `
      <div class="post-card" data-id="${post.id}">
        ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${escapeHtml(post.title)}" loading="lazy">` : ''}
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
      await handlePostCardClick(postId);
    });
  });
}

// ==========================================
// 게시글 카드 클릭 처리 (상세보기만)
// ==========================================
async function handlePostCardClick(postId) {
  await openDetailModal(postId);
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
async function openDetailModal(postId) {
  const detailModal = document.getElementById('detailModal');
  const detailTitle = document.getElementById('detailTitle');
  const detailImages = document.getElementById('detailImages');
  const detailContent = document.getElementById('detailContent');

  // 1. 모달을 즉시 표시 (속도 개선 핵심)
  detailModal.style.display = 'flex';

  // 2. 로딩 상태 표시
  detailTitle.textContent = '로딩 중...';
  detailImages.innerHTML = '';
  detailContent.textContent = '';

  try {
    // 3. DB에서 최신 게시글 데이터 가져오기
    const { data: post, error } = await supabaseClient
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

    // 4. 조회수 증가
    const newViews = (post.views || 0) + 1;
    await supabaseClient
      .from('posts')
      .update({ views: newViews })
      .eq('id', postId);

    // 조회수 업데이트 (로컬)
    post.views = newViews;

    // 캐시 업데이트
    const index = cachedPosts.findIndex(p => p.id === postId);
    if (index !== -1) {
      cachedPosts[index] = post;
    } else {
      cachedPosts.push(post);
    }

    // 5. 데이터로 내용 채우기
    detailTitle.innerHTML = escapeHtml(post.title);

    // 관리자일 때만 조회수 표시
    const isLoggedIn = await checkAuth();
    if (isLoggedIn && post.views !== undefined) {
      detailTitle.innerHTML += `<div style="font-size: 14px; color: #999; font-weight: normal; margin-top: 8px;">조회수: ${post.views}</div>`;
    }

    // 이미지들 표시 (위에서 아래로) - 즉시 표시 방식
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

      // 이미지 즉시 DOM에 추가 (로딩 표시 포함)
      imageUrls.forEach((url, index) => {
        const imgWrapper = document.createElement('div');
        imgWrapper.style.width = '100%';
        imgWrapper.style.marginBottom = '8px';
        imgWrapper.style.position = 'relative';
        imgWrapper.style.minHeight = '200px';
        imgWrapper.style.backgroundColor = '#f5f5f5';
        imgWrapper.style.borderRadius = '8px';
        imgWrapper.style.display = 'flex';
        imgWrapper.style.alignItems = 'center';
        imgWrapper.style.justifyContent = 'center';

        const loader = document.createElement('div');
        loader.textContent = '로딩 중...';
        loader.style.color = '#999';
        loader.style.fontSize = '14px';
        imgWrapper.appendChild(loader);

        const img = document.createElement('img');
        img.src = url;
        img.alt = post.title;
        img.style.width = '100%';
        img.style.borderRadius = '8px';
        img.style.display = 'none';

        img.onload = () => {
          loader.remove();
          img.style.display = 'block';
          imgWrapper.style.minHeight = 'auto';
          imgWrapper.style.backgroundColor = 'transparent';
        };

        img.onerror = () => {
          loader.textContent = '이미지 로드 실패';
          loader.style.color = '#e74c3c';
        };

        imgWrapper.appendChild(img);
        detailImages.appendChild(imgWrapper);
      });
    }

    // 내용 표시
    detailContent.textContent = post.content;

  } catch (err) {
    console.error('Error:', err);
    detailModal.style.display = 'none';
    alert('오류가 발생했습니다.');
  }
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
