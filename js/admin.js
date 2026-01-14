// ==========================================
// 관리자 페이지 JavaScript
// ==========================================

// 전역 변수
let currentEditingPostId = null;
let uploadedImageFiles = []; // 최대 3개까지
let uploadedThumbnailFile = null; // 썸네일 이미지
let cachedPosts = []; // 로드된 게시글 캐시 (속도 개선용)

// 페이지네이션 변수
const POSTS_PER_PAGE = 9; // 한 페이지당 게시글 수 (3x3 그리드)
let currentPage = 1; // 현재 페이지
let totalPages = 1; // 전체 페이지 수
let allPosts = []; // 전체 게시글 (필터링 전)

document.addEventListener('DOMContentLoaded', async function() {

  // 관리자 권한 체크 (페이지 접근 제어)
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
  await loadPosts();

  // 게시글 카드 클릭 이벤트 위임 (한 번만 등록)
  const postGrid = document.getElementById('postGrid');
  if (postGrid) {
    postGrid.addEventListener('click', async function(e) {
      const card = e.target.closest('.post-card');
      if (card) {
        const postId = card.getAttribute('data-id');
        await handlePostCardClick(postId);
      }
    });
  }

  // 글쓰기 링크 클릭
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

  // URL 해시가 있으면 해당 게시글 상세보기/수정 모달 열기
  const hash = window.location.hash;
  if (hash && hash.startsWith('#post-')) {
    const postId = hash.replace('#post-', '');
    if (postId) {
      // 페이지 로드 후 약간의 딜레이를 두고 모달 열기
      setTimeout(async () => {
        await openDetailModal(postId);
      }, 500);
    }
  } else if (hash && hash.startsWith('#edit-')) {
    // board.html에서 수정 버튼 클릭 시 이동
    const postId = hash.replace('#edit-', '');
    if (postId) {
      setTimeout(async () => {
        await openEditModal(postId);
        // 해시 제거 (뒤로가기 시 다시 열리지 않도록)
        history.replaceState(null, '', 'admin.html');
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

    // 내용 미리보기 (30자로 제한)
    const contentPreview = post.content.length > 30
      ? post.content.substring(0, 30) + '...'
      : post.content;

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
  // 이벤트 리스너는 DOMContentLoaded에서 이벤트 위임으로 한 번만 등록됨
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

  modalTitle.textContent = '새 글 작성';
  postForm.reset();
  currentEditingPostId = null;
  uploadedImageFiles = [];
  uploadedThumbnailFile = null;

  // 썸네일 미리보기 초기화
  const thumbnailPreview = document.getElementById('thumbnailPreview');
  thumbnailPreview.innerHTML = '';

  // 이미지 미리보기 초기화
  const imagePreview = document.getElementById('imagePreview');
  imagePreview.innerHTML = '';

  // 삭제 버튼 숨기기 (새 글 작성 모드)
  if (btnDelete) btnDelete.style.display = 'none';

  postModal.style.display = 'flex';
}

// ==========================================
// 모달 닫기
// ==========================================
function closePostModal() {
  const postModal = document.getElementById('postModal');
  postModal.style.display = 'none';
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

  // 1. 모달을 즉시 표시 (속도 개선 핵심)
  detailModal.style.display = 'flex';

  // 2. 로딩 상태 표시
  detailTitle.textContent = '로딩 중...';
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
        detailModal.style.display = 'none';
        alert('게시글을 불러오는데 실패했습니다.');
        return;
      }

      post = data;
    }

    // 4. 데이터로 내용 채우기
    detailTitle.textContent = post.title;

    // 이미지들 표시 (위에서 아래로) - 프리로드 방식으로 개선
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

      // 이미지 프리로드 (모든 이미지를 먼저 로드)
      const loadPromises = imageUrls.map(url => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null); // 에러 시에도 계속 진행
          img.src = url;
          img.alt = post.title;
          img.style.width = '100%';
          img.style.marginBottom = '8px';
          img.style.borderRadius = '8px';
        });
      });

      // 모든 이미지 로드 완료 후 한꺼번에 표시
      const loadedImages = await Promise.all(loadPromises);
      loadedImages.forEach(img => {
        if (img) detailImages.appendChild(img);
      });
    }

    // 내용 표시
    detailContent.textContent = post.content;

    // 관리자 버튼 표시
    detailAdminButtons.style.display = 'flex';

    // 수정 버튼 이벤트
    const btnEditFromDetail = document.getElementById('btnEditFromDetail');
    btnEditFromDetail.onclick = async function() {
      detailModal.style.display = 'none';
      await openEditModal(postId);
    };

    // 삭제 버튼 이벤트
    const btnDeleteFromDetail = document.getElementById('btnDeleteFromDetail');
    btnDeleteFromDetail.onclick = async function() {
      await deletePost(postId, post.image_url);
      detailModal.style.display = 'none';
    };

  } catch (err) {
    console.error('Error:', err);
    detailModal.style.display = 'none';
    alert('오류가 발생했습니다.');
  }
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

    // 기존 썸네일 미리보기 (삭제 버튼 포함)
    thumbnailPreview.innerHTML = '';
    if (post.thumbnail_url) {
      thumbnailPreview.innerHTML = `
        <div style="margin-top: 12px;">
          <img src="${post.thumbnail_url}" alt="기존 썸네일" style="max-width: 200px; border-radius: 8px;">
          <button type="button" class="btn-delete" onclick="deleteThumbnail('${postId}')" style="margin-top: 8px; display: block;">썸네일 삭제</button>
        </div>
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

    postModal.style.display = 'flex';

  } catch (err) {
    console.error('Error:', err);
    alert('오류가 발생했습니다.');
  }
}

// ==========================================
// 이미지 미리보기
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

  uploadedImageFiles = files;

  const imagePreview = document.getElementById('imagePreview');
  imagePreview.innerHTML = '';

  // 각 이미지를 위에서 아래로 미리보기 표시
  files.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = function(event) {
      const imgDiv = document.createElement('div');
      imgDiv.style.marginTop = '12px';
      imgDiv.innerHTML = `
        <img src="${event.target.result}" alt="미리보기 ${index + 1}" style="max-width: 100%; border-radius: 8px;">
      `;
      imagePreview.appendChild(imgDiv);
    };

    reader.readAsDataURL(file);
  });
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
      const thumbnailUrls = await uploadImages([uploadedThumbnailFile]);
      thumbnailUrl = thumbnailUrls[0];
    }

    // 상세 이미지 업로드 (여러 개)
    if (uploadedImageFiles && uploadedImageFiles.length > 0) {
      imageUrls = await uploadImages(uploadedImageFiles);
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
        alert('게시글 수정에 실패했습니다.');
        return;
      }

      alert('게시글이 수정되었습니다.');

    } else {
      // 새 글 작성
      const { error } = await supabaseClient
        .from('posts')
        .insert([
          {
            title,
            content,
            thumbnail_url: thumbnailUrl,
            image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null
          }
        ]);

      if (error) {
        console.error('Error creating post:', error);
        alert('게시글 작성에 실패했습니다.');
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
// 이미지 처리 (원본 유지)
// ==========================================
async function resizeImage(file) {
  // 원본 파일 그대로 반환 (품질 유지)
  return file;
}

// ==========================================
// 이미지 업로드 (여러 개) - 원본 그대로 업로드
// ==========================================
async function uploadImages(files) {
  try {
    const imageUrls = [];

    for (const file of files) {
      // 원본 파일 확장자 추출
      const originalExt = file.name.split('.').pop().toLowerCase();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${originalExt}`;
      const filePath = `${fileName}`;

      // 원본 파일 그대로 업로드
      const { error } = await supabaseClient.storage
        .from('post-images')
        .upload(filePath, file, {
          contentType: file.type
        });

      if (error) {
        console.error('Error uploading image:', error);
        throw error;
      }

      // 공개 URL 가져오기
      const { data: urlData } = supabaseClient.storage
        .from('post-images')
        .getPublicUrl(filePath);

      imageUrls.push(urlData.publicUrl);
    }

    return imageUrls;

  } catch (err) {
    console.error('Error:', err);
    alert('이미지 업로드에 실패했습니다.');
    return [];
  }
}

// ==========================================
// 썸네일 삭제
// ==========================================
async function deleteThumbnail(postId) {
  if (!confirm('썸네일을 삭제하시겠습니까?')) return;

  try {
    // 현재 게시글의 썸네일 URL 가져오기
    const { data: post, error: fetchError } = await supabaseClient
      .from('posts')
      .select('thumbnail_url')
      .eq('id', postId)
      .single();

    if (fetchError) {
      console.error('Error fetching post:', fetchError);
      alert('게시글을 불러오는데 실패했습니다.');
      return;
    }

    if (!post.thumbnail_url) {
      alert('삭제할 썸네일이 없습니다.');
      return;
    }

    // Storage에서 썸네일 삭제
    const thumbnailPath = post.thumbnail_url.split('/').pop();
    await supabaseClient.storage
      .from('post-images')
      .remove([thumbnailPath]);

    // DB에서 썸네일 URL 제거
    const { error } = await supabaseClient
      .from('posts')
      .update({ thumbnail_url: null })
      .eq('id', postId);

    if (error) {
      console.error('Error deleting thumbnail:', error);
      alert('썸네일 삭제에 실패했습니다.');
      return;
    }

    alert('썸네일이 삭제되었습니다.');
    await openEditModal(postId);

  } catch (err) {
    console.error('Error:', err);
    alert('오류가 발생했습니다.');
  }
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
    // 이미지가 있으면 Storage에서 삭제
    if (imageUrlData) {
      let imageUrls = [];
      if (typeof imageUrlData === 'string') {
        try {
          imageUrls = JSON.parse(imageUrlData);
        } catch {
          imageUrls = [imageUrlData];
        }
      } else if (Array.isArray(imageUrlData)) {
        imageUrls = imageUrlData;
      }

      // 모든 이미지 삭제
      for (const url of imageUrls) {
        const imagePath = url.split('/').pop();
        await supabaseClient.storage
          .from('post-images')
          .remove([imagePath]);
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
