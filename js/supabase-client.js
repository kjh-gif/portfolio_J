// ==========================================
// Supabase 클라이언트 초기화
// ==========================================

// Supabase 클라이언트 생성
const supabaseClient = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// 현재 로그인한 사용자 가져오기
async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

// 로그인 상태 확인
async function checkAuth() {
  const user = await getCurrentUser();
  return user !== null;
}

// 세션 가져오기
async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}
