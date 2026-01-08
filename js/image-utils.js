// ==========================================
// 이미지 URL 유틸리티 함수
// ==========================================

/**
 * Storage path를 public URL로 변환
 * @param {string} path - Storage path (예: "1767577013749_fn0ljm.png")
 * @returns {string} Public URL
 */
function getImagePublicUrl(path) {
  if (!path || typeof path !== 'string') {
    console.warn('⚠️  잘못된 image path:', path);
    return null;
  }

  const trimmedPath = path.trim();

  // 이미 full URL인 경우 (레거시 데이터 호환)
  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    console.log('📦 레거시 full URL 감지:', trimmedPath);
    return trimmedPath;
  }

  // path에서 public URL 생성
  const { data } = supabaseClient.storage
    .from('post-images')
    .getPublicUrl(trimmedPath);

  if (!data || !data.publicUrl) {
    console.error('❌ Public URL 생성 실패:', trimmedPath);
    return null;
  }

  return data.publicUrl;
}

/**
 * Storage URL에서 path 추출
 * @param {string} url - Full URL 또는 path
 * @returns {string} path만 추출
 */
function extractImagePath(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();

  // 이미 path만 있는 경우
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // full URL에서 path 추출
  // 예: https://.../storage/v1/object/public/post-images/파일명.png → 파일명.png
  const match = trimmedUrl.match(/\/post-images\/(.+)$/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }

  console.warn('⚠️  URL에서 path 추출 실패:', trimmedUrl);
  return null;
}

/**
 * 이미지 배열을 path 배열로 정규화
 * @param {string|Array} imageData - DB에서 가져온 image_url 데이터
 * @returns {Array} path 배열
 */
function normalizeImagePaths(imageData) {
  if (!imageData) {
    return [];
  }

  let paths = [];

  // JSON 문자열인 경우 파싱
  if (typeof imageData === 'string') {
    try {
      paths = JSON.parse(imageData);
    } catch {
      paths = [imageData];
    }
  } else if (Array.isArray(imageData)) {
    paths = imageData;
  } else {
    console.warn('⚠️  알 수 없는 image_url 형식:', imageData);
    return [];
  }

  // 각 항목을 path로 변환
  return paths
    .map(item => extractImagePath(item))
    .filter(path => path && path !== '');
}
