// ==========================================
// 관리자 페이지 JavaScript
// ==========================================

// 전역 에러 핸들러 (간소화)
window.addEventListener('error', function(e) {
  console.error('JavaScript 에러:', e.message, 'at', e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('Promise 에러:', e.reason);
});

// 전역 변수
// supabaseClient는 supabase-client.js에서 선언됨
let currentEditingPostId = null;
let uploadedImageFiles = []; // 최대 3개까지 (File 객체 배열)
let uploadedThumbnailFile = null; // 썸네일 이미지
let cachedPosts = []; // 로드된 게시글 캐시 (속도 개선용)

// 페이지네이션 변수
const POSTS_PER_PAGE = 9; // 한 페이지당 게시글 수 (3x3 그리드)
let currentPage = 1; // 현재 페이지
let totalPages = 1; // 전체 페이지 수
let allPosts = []; // 전체 게시글 (필터링 전)

// DOMContentLoaded가 이미 발생했을 수도 있으므로 체크
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPage);
} else {
  initAdminPage();
}

async function initAdminPage() {
  // Supabase 클라이언트 초기화
  try {
    if (typeof initSupabaseClient === 'function') {
      supabaseClient = initSupabaseClient();
    } else {
      console.error('initSupabaseClient 함수를 찾을 수 없습니다');
      alert('페이지 초기화에 실패했습니다. 새로고침 해주세요.');
      return;
    }
  } catch (error) {
    console.error('Supabase 초기화 실패:', error);
    alert('Supabase 초기화에 실패했습니다: ' + error.message);
    return;
  }

  try {
    // 관리자 권한 체크
    const isLoggedIn = await checkAuth();
    if (!isLoggedIn) {
      alert('로그인이 필요합니다.');
      window.location.href = 'login.html';
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      alert('로그인이 필요합니다.');
      window.location.href = 'login.html';
      return;
    }
  } catch (error) {
    console.error('인증 확인 중 에러:', error);
    alert('인증 확인 중 오류가 발생했습니다: ' + error.message);
  }

  // UI 요소
  const logoutBtn = document.getElementById('logoutBtn');
  const writeBtn = document.getElementById('writeBtn');
  const postModal = document.getElementById('postModal');
  const closeModal = document.querySelector('.close');
  const postForm = document.getElementById('postForm');
  const btnCancel = document.querySelector('.btn-cancel');
  const btnDelete = document.getElementById('btnDelete');
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');

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
        alert('로그아웃되었습니다.');
        window.location.href = 'index.html';
      } catch (err) {
        console.error('Error:', err);
        alert('오류가 발생했습니다.');
      }
    });
  }

  // 게시글 목록 로드
  try {
    await loadPosts();
  } catch (error) {
    console.error('게시글 로드 중 에러:', error);
  }

  // Write 버튼 클릭 이벤트 (최적화: 단일 이벤트 리스너)
  if (writeBtn) {
    writeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openPostModal();
    });
  }

  // 모달 닫기 버튼
  if (closeModal) {
    closeModal.addEventListener('click', function() {
      closePostModal();
    });
  }

  // 취소 버튼
  if (btnCancel) {
    btnCancel.addEventListener('click', function() {
      closePostModal();
    });
  }

  // 삭제 버튼 (수정 모드에서만 표시됨)
  if (btnDelete) {
    btnDelete.addEventListener('click', async function() {
      if (currentEditingPostId) {
        // 현재 게시글 정보 가져오기
        const { data: post } = await supabaseClient
          .from('posts')
          .select('image_url')
          .eq('id', currentEditingPostId)
          .single();

        await deletePost(currentEditingPostId, post?.image_url);
      }
    });
  }

  // 모달 외부 클릭 시 닫기
  window.addEventListener('click', function(e) {
    if (e.target === postModal) {
      closePostModal();
    }
  });

  // 게시글 작성/수정 폼 제출
  if (postForm) {
    postForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await handlePostSubmit();
    });
  }

  // 썸네일 이미지 파일 선택
  const thumbnailImage = document.getElementById('thumbnailImage');
  if (thumbnailImage) {
    thumbnailImage.addEventListener('change', function(e) {
      handleThumbnailPreview(e);
    });
  }

  // 상세 이미지 파일 선택
  const postImage = document.getElementById('postImage');
  if (postImage) {
    postImage.addEventListener('change', function(e) {
      handleImagePreview(e);
    });
  }

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
      setTimeout(async () => {
        await openDetailModal(postId);
      }, 500);
    }
  }

  // Storage 상태 진단 실행
  await diagnoseStorageStatus();
}

// ==========================================
// Storage 상태 진단 도구
// ==========================================
async function diagnoseStorageStatus() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Supabase Storage 상태 진단 (관리자)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // 1. Storage 버킷 목록 조회
    const { data: buckets, error: bucketsError } = await supabaseClient.storage.listBuckets();

    if (bucketsError) {
      console.warn('⚠️  Storage 버킷 목록 조회 실패:', bucketsError.message);
    } else {
      console.log('✓ Storage 버킷 목록:');
      buckets.forEach(bucket => {
        console.log(`  - ${bucket.name} (Public: ${bucket.public ? 'Yes ✓' : 'No ✗'})`);
      });

      // post-images 버킷 확인
      const postImagesBucket = buckets.find(b => b.name === 'post-images');
      if (postImagesBucket) {
        if (postImagesBucket.public) {
          console.log('✓ post-images 버킷: Public 상태 (정상)');
        } else {
          console.warn('⚠️  post-images 버킷: Private 상태');
          console.warn('   해결방법: Supabase Dashboard → Storage → post-images → Public bucket 활성화');
        }
      } else {
        console.error('❌ post-images 버킷을 찾을 수 없습니다');
      }
    }

    // 2. 관리자 권한 확인
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      console.log('');
      console.log('✓ 관리자 인증 상태:');
      console.log('  User ID:', user.id);
      console.log('  Email:', user.email);
    }

    // 3. 실제 게시글의 이미지 URL 샘플 확인
    if (cachedPosts && cachedPosts.length > 0) {
      const postsWithImages = cachedPosts.filter(p => p.image_url);
      if (postsWithImages.length > 0) {
        console.log('');
        console.log('✓ 게시글 이미지 URL 샘플:');
        postsWithImages.slice(0, 2).forEach(post => {
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
          console.log(`  게시글 "${post.title}":`);
          imageUrls.forEach((url, idx) => {
            console.log(`    [${idx}] ${url}`);
          });
        });
      }
    }

  } catch (error) {
    console.error('❌ Storage 진단 중 오류:', error.message);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
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
    // ✅ 개선: 썸네일 또는 첫 번째 이미지 사용
    let thumbnailUrl = null;

    // 썸네일이 있으면 사용
    if (post.thumbnail_url) {
      thumbnailUrl = getImagePublicUrl(extractImagePath(post.thumbnail_url));
    }

    // 썸네일이 없으면 첫 번째 상세 이미지 사용
    if (!thumbnailUrl && post.image_url) {
      const imagePaths = normalizeImagePaths(post.image_url);
      if (imagePaths.length > 0) {
        thumbnailUrl = getImagePublicUrl(imagePaths[0]);
      }
    }

    // 이미지 URL을 data 속성으로 저장 (프리로딩용)
    const imageUrlsJson = post.image_url ? (typeof post.image_url === 'string' ? post.image_url : JSON.stringify(post.image_url)) : '';

    // 내용 미리보기 (30자로 제한)
    const contentPreview = post.content.length > 30
      ? post.content.substring(0, 30) + '...'
      : post.content;

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
// 게시글 카드 클릭 처리
// ==========================================
async function handlePostCardClick(postId) {
  // 관리자: 상세보기 모달 열기 (수정/삭제 버튼 포함)
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
// 글쓰기 모달 열기
// ==========================================
function openPostModal() {
  const postModal = document.getElementById('postModal');
  const modalTitle = document.getElementById('modalTitle');
  const postForm = document.getElementById('postForm');
  const btnDelete = document.getElementById('btnDelete');

  if (!postModal || !modalTitle || !postForm) {
    console.error('모달 요소를 찾을 수 없습니다');
    alert('모달을 표시할 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  modalTitle.textContent = '새 글 작성';
  postForm.reset();
  currentEditingPostId = null;
  uploadedImageFiles = [];
  uploadedThumbnailFile = null;

  // 미리보기 초기화
  const thumbnailPreview = document.getElementById('thumbnailPreview');
  const imagePreview = document.getElementById('imagePreview');
  if (thumbnailPreview) thumbnailPreview.innerHTML = '';
  if (imagePreview) imagePreview.innerHTML = '';

  // 삭제 버튼 숨기기
  if (btnDelete) btnDelete.style.display = 'none';

  // 모달 표시 (애니메이션)
  postModal.style.display = 'flex';
  requestAnimationFrame(() => {
    postModal.classList.add('show');
  });
}

// ==========================================
// 모달 닫기
// ==========================================
function closePostModal() {
  const postModal = document.getElementById('postModal');

  // show 클래스 제거로 페이드 아웃
  postModal.classList.remove('show');

  // 애니메이션 완료 후 숨김
  setTimeout(() => {
    postModal.style.display = 'none';
  }, 200);

  currentEditingPostId = null;
  uploadedImageFiles = [];
  uploadedThumbnailFile = null;
}

// ==========================================
// 상세보기 모달 열기
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

      // URL 필터링: 유효한 URL만 사용
      imageUrls = imageUrls.filter(url => {
        if (!url || typeof url !== 'string' || url.trim() === '') {
          console.warn('잘못된 이미지 URL 제외:', url);
          return false;
        }
        return true;
      });

      // 로딩 상태 초기화
      detailImages.innerHTML = '';

      // 이미지가 없는 경우 안내 메시지
      if (imageUrls.length === 0) {
        detailImages.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">이미지가 없습니다.</p>';
      } else {
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
            imgContainer.style.animation = 'none';
            // 페이드 인 효과
            setTimeout(() => {
              img.style.opacity = '1';
            }, 10);
          };

          img.onerror = () => {
            // 에러 시 스피너 제거, 에러 메시지 표시
            console.error('이미지 로드 실패:', url);
            console.error('게시글 ID:', post.id);
            console.error('이미지 인덱스:', index);
            loader.innerHTML = `
              <div style="text-align: center;">
                <p style="margin: 0 0 8px 0; color: #dc3545; font-weight: bold;">이미지 로드 실패</p>
                <p style="margin: 0; font-size: 12px; color: #666; word-break: break-all; max-width: 300px;">${url}</p>
              </div>
            `;
            imgContainer.style.minHeight = '150px';
            imgContainer.style.animation = 'none';
          };

          imgContainer.appendChild(img);
          detailImages.appendChild(imgContainer);

          // 이미지 로드 시작
          img.src = url;
        });
      }
    } else {
      // image_url 필드 자체가 없는 경우
      detailImages.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">이미지가 없습니다.</p>';
    }

    // 내용 표시
    detailContent.textContent = post.content;

    // 관리자 버튼 표시
    detailAdminButtons.style.display = 'flex';

    // 수정 버튼 이벤트
    const btnEditFromDetail = document.getElementById('btnEditFromDetail');
    btnEditFromDetail.onclick = async function() {
      closeDetailModalWithAnimation();
      await openEditModal(postId);
    };

    // 삭제 버튼 이벤트
    const btnDeleteFromDetail = document.getElementById('btnDeleteFromDetail');
    btnDeleteFromDetail.onclick = async function() {
      await deletePost(postId, post.image_url);
      closeDetailModalWithAnimation();
    };

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
// 수정 모달 열기
// ==========================================
async function openEditModal(postId) {
  try {
    // 게시글 데이터 가져오기
    const { data: post, error } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error) {
      console.error('Error fetching post:', error);
      alert('게시글을 불러오는데 실패했습니다.');
      return;
    }

    const postModal = document.getElementById('postModal');
    const modalTitle = document.getElementById('modalTitle');
    const postTitle = document.getElementById('postTitle');
    const postContent = document.getElementById('postContent');
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    const imagePreview = document.getElementById('imagePreview');
    const btnDelete = document.getElementById('btnDelete');

    modalTitle.textContent = '글 수정';
    postTitle.value = post.title;
    postContent.value = post.content;
    currentEditingPostId = postId;

    // 기존 썸네일 미리보기
    thumbnailPreview.innerHTML = '';
    if (post.thumbnail_url) {
      thumbnailPreview.innerHTML = `
        <img src="${post.thumbnail_url}" alt="기존 썸네일" style="max-width: 200px; border-radius: 8px; margin-top: 12px;">
      `;
    }

    // 기존 상세 이미지 미리보기
    imagePreview.innerHTML = '';
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

      // 각 이미지를 위에서 아래로 표시 (개별 삭제 버튼 포함)
      imageUrls.forEach((url, index) => {
        const imgDiv = document.createElement('div');
        imgDiv.style.marginTop = '12px';
        imgDiv.innerHTML = `
          <img src="${url}" alt="기존 이미지 ${index + 1}" style="max-width: 100%; border-radius: 8px;">
          <button type="button" class="btn-delete" onclick="deleteSingleImage('${postId}', ${index})" style="margin-top: 8px;">이미지 ${index + 1} 삭제</button>
        `;
        imagePreview.appendChild(imgDiv);
      });
    }

    // 삭제 버튼 표시 (수정 모드)
    if (btnDelete) btnDelete.style.display = 'inline-block';

    // 1. 모달을 즉시 표시
    postModal.style.display = 'flex';

    // 2. 애니메이션을 위해 show 클래스 추가
    requestAnimationFrame(() => {
      postModal.classList.add('show');
    });

  } catch (err) {
    console.error('Error:', err);
    alert('오류가 발생했습니다.');
  }
}

// ==========================================
// 이미지 미리보기 (위/아래 버튼으로 순서 변경)
// ==========================================
function handleImagePreview(e) {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;

  // 최대 3개까지만 허용
  if (files.length > 3) {
    alert('이미지는 최대 3개까지만 업로드 가능합니다.');
    e.target.value = '';
    return;
  }

  // File 객체 배열로 저장
  uploadedImageFiles = files;
  updateImagePreview();
}

// 이미지 미리보기 UI 업데이트
function updateImagePreview() {
  const imagePreview = document.getElementById('imagePreview');
  imagePreview.innerHTML = '';

  if (!uploadedImageFiles || uploadedImageFiles.length === 0) {
    return;
  }

  uploadedImageFiles.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = function(event) {
      const imgDiv = document.createElement('div');
      imgDiv.style.marginTop = '12px';
      imgDiv.style.padding = '12px';
      imgDiv.style.border = '2px solid #ddd';
      imgDiv.style.borderRadius = '8px';
      imgDiv.style.backgroundColor = '#f9f9f9';

      imgDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #3b3b3b; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
            ${index + 1}
          </div>
          <img src="${event.target.result}" alt="미리보기 ${index + 1}" style="max-width: 150px; border-radius: 8px; flex-shrink: 0;">
          <div style="flex: 1;">
            <p style="margin: 0; font-size: 14px; color: #666;">${file.name}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">${(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <button type="button" onclick="moveImageUp(${index})" ${index === 0 ? 'disabled' : ''}
              style="padding: 4px 8px; font-size: 12px; background: #3b3b3b; color: white; border: none; border-radius: 4px; cursor: pointer;">
              ▲
            </button>
            <button type="button" onclick="moveImageDown(${index})" ${index === uploadedImageFiles.length - 1 ? 'disabled' : ''}
              style="padding: 4px 8px; font-size: 12px; background: #3b3b3b; color: white; border: none; border-radius: 4px; cursor: pointer;">
              ▼
            </button>
          </div>
        </div>
      `;

      imagePreview.appendChild(imgDiv);
    };

    reader.readAsDataURL(file);
  });
}

// 이미지 순서 위로 이동
function moveImageUp(index) {
  if (index === 0) return;

  const newFiles = Array.from(uploadedImageFiles);
  const temp = newFiles[index];
  newFiles[index] = newFiles[index - 1];
  newFiles[index - 1] = temp;
  uploadedImageFiles = newFiles;

  updateImagePreview();
}

// 이미지 순서 아래로 이동
function moveImageDown(index) {
  if (index === uploadedImageFiles.length - 1) return;

  const newFiles = Array.from(uploadedImageFiles);
  const temp = newFiles[index];
  newFiles[index] = newFiles[index + 1];
  newFiles[index + 1] = temp;
  uploadedImageFiles = newFiles;

  updateImagePreview();
}

// ==========================================
// 썸네일 이미지 미리보기
// ==========================================
function handleThumbnailPreview(e) {
  const file = e.target.files[0];
  if (!file) return;

  uploadedThumbnailFile = file;

  const thumbnailPreview = document.getElementById('thumbnailPreview');
  const reader = new FileReader();

  reader.onload = function(event) {
    thumbnailPreview.innerHTML = `
      <img src="${event.target.result}" alt="썸네일 미리보기" style="max-width: 200px; border-radius: 8px; margin-top: 12px;">
    `;
  };

  reader.readAsDataURL(file);
}

// ==========================================
// 게시글 작성/수정 처리
// ==========================================
async function handlePostSubmit() {
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();

  if (!title || !content) {
    alert('제목과 내용을 입력해주세요.');
    return;
  }

  try {
    let imageUrls = [];
    let thumbnailUrl = null;

    // 썸네일 이미지 업로드
    if (uploadedThumbnailFile) {
      try {
        const thumbnailUrls = await uploadImages([uploadedThumbnailFile]);
        thumbnailUrl = thumbnailUrls[0];
      } catch (err) {
        console.error('썸네일 업로드 실패:', err);
        alert('썸네일 이미지 업로드에 실패했습니다.');
        return;
      }
    }

    // 상세 이미지 업로드
    if (uploadedImageFiles && uploadedImageFiles.length > 0) {
      try {
        imageUrls = await uploadImages(uploadedImageFiles);
      } catch (err) {
        console.error('상세 이미지 업로드 실패:', err);
        alert('상세 이미지 업로드에 실패했습니다.');
        return;
      }
    }

    if (currentEditingPostId) {
      // 수정
      const updateData = { title, content, updated_at: new Date() };

      // 썸네일 업데이트
      if (thumbnailUrl) {
        updateData.thumbnail_url = thumbnailUrl;
      }

      // 새 이미지가 있으면 추가 (기존 이미지 유지하면서)
      if (imageUrls.length > 0) {
        // 기존 이미지 URL 가져오기
        const { data: existingPost } = await supabaseClient
          .from('posts')
          .select('image_url')
          .eq('id', currentEditingPostId)
          .single();

        let existingUrls = [];
        if (existingPost && existingPost.image_url) {
          // 기존 데이터가 배열인지 문자열인지 확인
          if (typeof existingPost.image_url === 'string') {
            try {
              existingUrls = JSON.parse(existingPost.image_url);
            } catch {
              existingUrls = [existingPost.image_url];
            }
          } else if (Array.isArray(existingPost.image_url)) {
            existingUrls = existingPost.image_url;
          }
        }

        // 기존 + 새 이미지 (최대 3개)
        const allUrls = [...existingUrls, ...imageUrls].slice(0, 3);
        updateData.image_url = JSON.stringify(allUrls);
      }

      const { error } = await supabaseClient
        .from('posts')
        .update(updateData)
        .eq('id', currentEditingPostId);

      if (error) {
        console.error('Error updating post:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        alert(`게시글 수정에 실패했습니다.\n${error.message || error.hint || '알 수 없는 오류'}`);
        return;
      }

      alert('게시글이 수정되었습니다.');

    } else {
      // 새 글 작성
      const postData = {
        title,
        content,
        thumbnail_url: thumbnailUrl,
        image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null
      };

      const { error } = await supabaseClient
        .from('posts')
        .insert([postData])
        .select();

      if (error) {
        console.error('DB 저장 실패:', error);
        alert(`게시글 작성에 실패했습니다.\n${error.message || error.hint || '알 수 없는 오류'}`);
        return;
      }

      alert('게시글이 작성되었습니다.');
    }

    closePostModal();
    await loadPosts();

  } catch (err) {
    console.error('Error:', err);
    alert('오류가 발생했습니다.');
  }
}

// ==========================================
// 이미지 업로드 (여러 개)
// ==========================================
async function uploadImages(files) {
  const imageUrls = [];
  const filesArray = Array.isArray(files) ? files : Array.from(files);

  // 현재 사용자 확인
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    throw new Error('로그인이 필요합니다.');
  }

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];

    if (!file || !file.name) {
      throw new Error(`파일 ${i + 1}이 유효하지 않습니다.`);
    }

    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}_${random}.${fileExt}`;

    // Storage에 업로드
    const { error: uploadError } = await supabaseClient.storage
      .from('post-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) {
      console.error('Storage 업로드 실패:', uploadError.message);
      if (uploadError.statusCode === '403' || uploadError.message.includes('403')) {
        alert('이미지 업로드 권한이 없습니다.\n\nSupabase Storage 정책을 확인해주세요.');
      }
      throw new Error(`${file.name} 업로드 실패: ${uploadError.message}`);
    }

    // ✅ 개선: Storage에 업로드 후 실제 파일 존재 확인
    const { data: fileList, error: listError } = await supabaseClient.storage
      .from('post-images')
      .list('', {
        search: fileName
      });

    if (listError || !fileList || fileList.length === 0) {
      console.error('❌ 업로드 검증 실패: Storage에 파일이 없습니다:', fileName);
      throw new Error(`업로드 검증 실패: ${fileName}`);
    }

    console.log('✓ 이미지 업로드 성공:', fileName);
    console.log('  Storage path:', fileName);

    // ✅ 개선: DB에는 path만 저장 (full URL 저장 금지)
    imageUrls.push(fileName);
  }

  console.log('✓ 총 ' + imageUrls.length + '개 이미지 업로드 완료');
  return imageUrls;
}

// ==========================================
// 개별 이미지 삭제
// ==========================================
async function deleteSingleImage(postId, imageIndex) {
  if (!confirm('이미지를 삭제하시겠습니까?')) return;

  try {
    // 현재 게시글의 이미지 URL 가져오기
    const { data: post, error: fetchError } = await supabaseClient
      .from('posts')
      .select('image_url')
      .eq('id', postId)
      .single();

    if (fetchError) {
      console.error('Error fetching post:', fetchError);
      alert('게시글을 불러오는데 실패했습니다.');
      return;
    }

    // 이미지 URL 배열 파싱
    let imageUrls = [];
    if (post.image_url) {
      if (typeof post.image_url === 'string') {
        try {
          imageUrls = JSON.parse(post.image_url);
        } catch {
          imageUrls = [post.image_url];
        }
      } else if (Array.isArray(post.image_url)) {
        imageUrls = post.image_url;
      }
    }

    if (imageIndex < 0 || imageIndex >= imageUrls.length) {
      alert('잘못된 이미지 인덱스입니다.');
      return;
    }

    // Storage에서 해당 이미지 삭제
    const imageUrl = imageUrls[imageIndex];
    const imagePath = imageUrl.split('/').pop();
    await supabaseClient.storage
      .from('post-images')
      .remove([imagePath]);

    // 배열에서 해당 이미지 제거
    imageUrls.splice(imageIndex, 1);

    // DB 업데이트
    const { error } = await supabaseClient
      .from('posts')
      .update({
        image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null
      })
      .eq('id', postId);

    if (error) {
      console.error('Error deleting image:', error);
      alert('이미지 삭제에 실패했습니다.');
      return;
    }

    alert('이미지가 삭제되었습니다.');
    await openEditModal(postId);

  } catch (err) {
    console.error('Error:', err);
    alert('오류가 발생했습니다.');
  }
}

// ==========================================
// 게시글 삭제
// ==========================================
async function deletePost(postId, imageUrlData) {
  if (!confirm('게시글을 삭제하시겠습니까?')) return;

  try {
    // ✅ 개선: 이미지가 있으면 Storage에서 삭제 (재발 방지)
    if (imageUrlData) {
      // path 배열로 정규화
      const imagePaths = normalizeImagePaths(imageUrlData);

      console.log('🗑️  삭제할 이미지 paths:', imagePaths);

      // 모든 이미지 삭제
      for (const path of imagePaths) {
        if (!path) continue;

        const { error: removeError } = await supabaseClient.storage
          .from('post-images')
          .remove([path]);

        if (removeError) {
          console.warn('⚠️  이미지 삭제 실패:', path, removeError);
          // 에러 발생해도 계속 진행 (다른 이미지들도 삭제)
        } else {
          console.log('✓ 이미지 삭제 성공:', path);
        }
      }
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
    closePostModal();
    await loadPosts();

  } catch (err) {
    console.error('Error:', err);
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
