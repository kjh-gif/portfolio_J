// ==========================================
// 게시판 페이지 JavaScript
// ==========================================

document.addEventListener('DOMContentLoaded', async function() {

  // 로그인 상태 확인
  const isLoggedIn = await checkAuth();
  const user = await getCurrentUser();

  // UI 요소
  const logoutBtn = document.getElementById('logoutBtn');
  const writeBtn = document.getElementById('writeBtn');

  // 관리자 로그인 상태에 따른 UI 표시
  if (isLoggedIn && user) {
    // 로그인 상태: 로그아웃 버튼 표시
    logoutBtn.style.display = 'block';

    // 글쓰기 버튼 표시 (관리자만)
    if (writeBtn) {
      writeBtn.style.display = 'block';
    }
  } else {
    // 비로그인 상태: 버튼 숨기기
    logoutBtn.style.display = 'none';
    if (writeBtn) {
      writeBtn.style.display = 'none';
    }
  }

  // 로그아웃 버튼 이벤트
  logoutBtn.addEventListener('click', async function() {
    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        console.error('Logout error:', error);
        alert('로그아웃에 실패했습니다.');
        return;
      }

      // 로그아웃 성공 - 메인 페이지로 이동
      alert('로그아웃되었습니다.');
      window.location.href = 'index.html';

    } catch (err) {
      console.error('Error:', err);
      alert('오류가 발생했습니다.');
    }
  });

  // TODO: 게시판 기능 구현 예정
  // - 게시글 목록 조회
  // - 게시글 작성
  // - 게시글 수정/삭제
  // - 검색 기능

});
