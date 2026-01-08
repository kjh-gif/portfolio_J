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

/**
 * Storage에 파일이 실제로 존재하는지 확인
 * @param {string} path - Storage path
 * @returns {Promise<boolean>} 파일 존재 여부
 */
async function checkImageExists(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }

  try {
    // Storage에서 파일 목록 조회
    const { data, error } = await supabaseClient.storage
      .from('post-images')
      .list('', {
        search: path
      });

    if (error || !data || data.length === 0) {
      console.warn('⚠️  Storage에 파일 없음:', path);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ checkImageExists 에러:', error);
    return false;
  }
}

/**
 * 이미지 path 배열 검증 및 정리 (존재하지 않는 파일 제거)
 * @param {Array} paths - path 배열
 * @returns {Promise<Array>} 검증된 path 배열
 */
async function validateAndCleanImagePaths(paths) {
  if (!paths || paths.length === 0) {
    return [];
  }

  const validPaths = [];

  for (const path of paths) {
    const exists = await checkImageExists(path);
    if (exists) {
      validPaths.push(path);
    } else {
      console.warn('🗑️  존재하지 않는 이미지 제거:', path);
    }
  }

  return validPaths;
}

/**
 * 게시글의 깨진 이미지 자동 정리 (DB 업데이트)
 * @param {string} postId - 게시글 ID
 * @param {Array} validPaths - 검증된 path 배열
 */
async function cleanBrokenImages(postId, validPaths) {
  if (!postId) return;

  try {
    const updateData = {
      image_url: validPaths.length > 0 ? JSON.stringify(validPaths) : null
    };

    const { error } = await supabaseClient
      .from('posts')
      .update(updateData)
      .eq('id', postId);

    if (error) {
      console.error('❌ DB 업데이트 실패:', error);
    } else {
      console.log('✓ 깨진 이미지 자동 정리 완료:', postId);
    }
  } catch (error) {
    console.error('❌ cleanBrokenImages 에러:', error);
  }
}
