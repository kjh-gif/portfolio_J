// ==========================================
// 로그인 페이지 JavaScript
// ==========================================

document.addEventListener('DOMContentLoaded', async function() {

  // 이미 로그인되어 있는지 확인
  const isLoggedIn = await checkAuth();
  if (isLoggedIn) {
    // 이미 로그인되어 있으면 게시판으로 리다이렉트
    window.location.href = 'board.html';
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const messageEl = document.getElementById('message');

  // 로그인 폼 제출 이벤트
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // 메시지 초기화
    messageEl.textContent = '';
    messageEl.className = 'message';

    try {
      // Supabase 로그인 시도
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        // 로그인 실패
        showMessage('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.', 'error');
        console.error('Login error:', error);
        return;
      }

      // 로그인 성공
      showMessage('로그인 성공! 게시판으로 이동합니다...', 'success');

      // 1초 후 게시판으로 리다이렉트
      setTimeout(() => {
        window.location.href = 'board.html';
      }, 1000);

    } catch (err) {
      showMessage('오류가 발생했습니다. 다시 시도해주세요.', 'error');
      console.error('Error:', err);
    }
  });

  // 메시지 표시 함수
  function showMessage(message, type) {
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
  }

});
