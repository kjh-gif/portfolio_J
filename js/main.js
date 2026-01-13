// ==========================================
// 메인 JavaScript
// ==========================================

// 전역 변수
let cachedWorkPosts = []; // 로드된 게시글 캐시 (속도 개선용)
let isUserLoggedIn = false; // 로그인 상태 캐시 (속도 개선용)

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async function() {

  // 로그인 상태 확인 및 UI 업데이트
  await updateAuthUI();

  // 게시글 목록 로드
  await loadWorkPosts();

  // 부드러운 스크롤 효과
  initSmoothScroll();

  // 스크롤 시 헤더 스타일 변경
  initHeaderScroll();

  // 작업물 카드 클릭 이벤트 (이벤트 위임 - 한 번만 등록)
  const workGrid = document.getElementById('workGrid');
  workGrid.addEventListener('click', async function(e) {
    const card = e.target.closest('.work-card');
    if (card) {
      const postId = card.getAttribute('data-id');
      if (postId) {
        await openDetailModal(postId);
      }
    }
  });

  // URL 해시가 있으면 해당 섹션으로 스크롤 (외부 페이지에서 이동 시)
  const hash = window.location.hash;
  if (hash) {
    setTimeout(() => {
      const targetElement = document.querySelector(hash);
      if (targetElement) {
        const headerHeight = 80;
        const targetPosition = targetElement.offsetTop - headerHeight;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    }, 100); // 페이지 로드 후 약간의 딜레이
  }

});

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
// 작업물 카드 클릭 이벤트 (이벤트 위임)
// ==========================================
// 이벤트 위임은 DOMContentLoaded에서 한 번만 등록됨 (line 26-34)

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
// 로그인 상태에 따른 UI 업데이트
// ==========================================
async function updateAuthUI() {
  const logoutBtn = document.getElementById('logoutBtn');

  // 로그인 상태 확인 (전역 변수에 캐시 - 속도 개선)
  const isLoggedIn = await checkAuth();
  isUserLoggedIn = isLoggedIn; // 전역 변수에 저장

  if (isLoggedIn) {
    // 로그인 상태: 로그아웃 버튼 표시 (푸터에)
    if (logoutBtn) logoutBtn.style.display = 'inline';
  } else {
    // 비로그인 상태: 로그아웃 버튼 숨김
    if (logoutBtn) logoutBtn.style.display = 'none';
  }

  // 로그아웃 버튼 이벤트
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
      try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
          console.error('Logout error:', error);
          alert('로그아웃에 실패했습니다.');
          return;
        }

        // 로그아웃 성공
        alert('로그아웃되었습니다.');
        window.location.reload();

      } catch (err) {
        console.error('Error:', err);
        alert('오류가 발생했습니다.');
      }
    });
  }
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
// 게시글 화면에 표시 (메인 페이지용 - 최대 3개만 표시)
// ==========================================
function displayWorkPosts(posts) {
  const workGrid = document.getElementById('workGrid');

  if (!posts || posts.length === 0) {
    workGrid.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">게시글이 없습니다.</p>';
    return;
  }

  // 메인 페이지에서는 최대 4개까지 표시 (태블릿 대응)
  const limitedPosts = posts.slice(0, 4);

  workGrid.innerHTML = limitedPosts.map(post => {
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
        ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${escapeHtml(post.title)}" loading="lazy">` : ''}
        <div class="work-card-content">
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(contentPreview)}</p>
        </div>
      </div>
    `;
  }).join('');

  // 카드 클릭 이벤트는 DOMContentLoaded에서 이미 등록됨 (이벤트 위임 방식)
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

  // 1. 이미지 영역 즉시 초기화 (중복 방지)
  detailImages.innerHTML = '';
  detailTitle.textContent = '로딩 중...';
  detailContent.textContent = '';

  // 2. 모달 표시
  detailModal.style.display = 'flex';

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
    const index = cachedWorkPosts.findIndex(p => p.id === postId);
    if (index !== -1) {
      cachedWorkPosts[index] = post;
    } else {
      cachedWorkPosts.push(post);
    }

    // 5. 데이터로 내용 채우기
    detailTitle.innerHTML = escapeHtml(post.title);

    // 관리자일 때만 조회수 표시 (캐시된 로그인 상태 사용)
    if (isUserLoggedIn && post.views !== undefined) {
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

    // 로그인 상태 확인 후 관리자 버튼 표시 여부 결정 (캐시된 값 사용)
    if (isUserLoggedIn) {
      detailAdminButtons.style.display = 'flex';

      // 수정 버튼 클릭 시 admin.html 수정 모달로 이동
      const btnEditFromDetail = document.getElementById('btnEditFromDetail');
      btnEditFromDetail.onclick = function() {
        window.location.href = `admin.html#edit-${postId}`;
      };

      // 삭제 버튼 - 직접 삭제 처리
      const btnDeleteFromDetail = document.getElementById('btnDeleteFromDetail');
      btnDeleteFromDetail.onclick = async function() {
        if (!confirm('게시글을 삭제하시겠습니까?')) return;

        try {
          // 이미지가 있으면 Storage에서 삭제
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

            for (const url of imageUrls) {
              const imagePath = url.split('/').pop();
              await supabaseClient.storage
                .from('post-images')
                .remove([imagePath]);
            }
          }

          // 썸네일 삭제
          if (post.thumbnail_url) {
            const thumbnailPath = post.thumbnail_url.split('/').pop();
            await supabaseClient.storage
              .from('post-images')
              .remove([thumbnailPath]);
          }

          // 게시글 삭제
          const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);

          if (error) {
            console.error('Error deleting post:', error);
            alert('게시글 삭제에 실패했습니다.');
            return;
          }

          alert('게시글이 삭제되었습니다.');
          detailModal.style.display = 'none';

          // Work 섹션 새로고침
          await loadWorkPosts();

        } catch (err) {
          console.error('Error:', err);
          alert('오류가 발생했습니다.');
        }
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
