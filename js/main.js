// ==========================================
// 메인 JavaScript
// ==========================================

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async function() {

  // 로그인 상태 확인 및 UI 업데이트
  await updateAuthUI();

  // 부드러운 스크롤 효과
  initSmoothScroll();

  // 스크롤 시 헤더 스타일 변경
  initHeaderScroll();

  // 작업물 카드 클릭 이벤트
  initWorkCards();

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
// 작업물 카드 클릭 이벤트
// ==========================================
function initWorkCards() {
  const workCards = document.querySelectorAll('.work-card');

  workCards.forEach(card => {
    card.addEventListener('click', function() {
      // 게시판 페이지로 이동
      window.location.href = 'board.html';
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
      const sectionHeight = section.clientHeight;

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
  const loginLink = document.getElementById('loginLink');
  const logoutBtn = document.getElementById('logoutBtn');

  // 로그인 상태 확인
  const isLoggedIn = await checkAuth();

  if (isLoggedIn) {
    // 로그인 상태: 로그아웃 버튼 표시, 로그인 링크 숨김
    if (loginLink) loginLink.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'block';
  } else {
    // 비로그인 상태: 로그인 링크 표시, 로그아웃 버튼 숨김
    if (loginLink) loginLink.style.display = 'block';
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
