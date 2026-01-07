// ==========================================
// Supabase 클라이언트 초기화
// ==========================================

console.log('>>> supabase-client.js 로드 시작 <<<');

// Supabase 클라이언트 변수 (지연 초기화)
let supabaseClient = null;

// Supabase 클라이언트 초기화 함수
function initSupabaseClient() {
  if (supabaseClient) {
    console.log('Supabase 클라이언트 이미 초기화됨');
    return supabaseClient;
  }

  console.log('Supabase 클라이언트 초기화 중...');
  console.log('- window.supabase:', typeof window.supabase);
  console.log('- SUPABASE_CONFIG:', typeof SUPABASE_CONFIG);

  if (typeof window.supabase === 'undefined') {
    console.error('❌ window.supabase가 정의되지 않았습니다!');
    throw new Error('Supabase 라이브러리가 로드되지 않았습니다.');
  }

  if (typeof SUPABASE_CONFIG === 'undefined') {
    console.error('❌ SUPABASE_CONFIG가 정의되지 않았습니다!');
    throw new Error('Supabase 설정이 로드되지 않았습니다.');
  }

  console.log('- URL:', SUPABASE_CONFIG.url);
  console.log('- Key:', SUPABASE_CONFIG.anonKey ? '설정됨' : '없음');

  supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
  );

  console.log('✓ Supabase 클라이언트 초기화 완료');
  return supabaseClient;
}

// 현재 로그인한 사용자 가져오기
async function getCurrentUser() {
  const client = initSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

// 로그인 상태 확인
async function checkAuth() {
  const user = await getCurrentUser();
  return user !== null;
}

// 세션 가져오기
async function getSession() {
  const client = initSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  return session;
}

console.log('>>> supabase-client.js 로드 완료 <<<');
