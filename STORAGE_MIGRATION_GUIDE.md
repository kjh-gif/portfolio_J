# Supabase Storage 404 문제 해결 및 마이그레이션 가이드

## 📋 문제 원인

기존 코드는 DB에 **full public URL**을 저장하고 있었습니다:
```json
{
  "image_url": "[\"https://qbvjrycjbeztsoqwdvvg.supabase.co/storage/v1/object/public/post-images/1767577013749_fn0ljm.png\"]"
}
```

**문제점**:
1. ❌ Storage에 파일이 없어도 URL은 생성됨 (404 발생)
2. ❌ bucket이 private이면 public URL 접근 불가
3. ❌ URL 변경 시 DB 전체 수정 필요
4. ❌ 삭제 시 path 추출 로직 복잡

---

## ✅ 개선 방안

### 1. DB 저장 구조 변경

**변경 전**:
```json
{
  "image_url": "[\"https://...supabase.co/storage/v1/object/public/post-images/파일명.png\"]"
}
```

**변경 후**:
```json
{
  "image_url": "[\"1767577013749_fn0ljm.png\"]"
}
```

✅ **장점**:
- Storage path만 저장 (간결)
- URL 변경에 유연
- 삭제/수정 간편
- 레거시 데이터도 호환 (자동 변환)

---

## 🛠️ 코드 수정 내용

### (1) 업로드 코드 개선 (admin.js)

**변경 전** (문제 코드):
```javascript
// ❌ full URL을 DB에 저장
const { data: urlData } = supabaseClient.storage
  .from('post-images')
  .getPublicUrl(fileName);

imageUrls.push(urlData.publicUrl); // full URL
```

**변경 후** (개선):
```javascript
// ✅ Storage 업로드 후 실제 파일 존재 확인
const { data: fileList, error: listError } = await supabaseClient.storage
  .from('post-images')
  .list('', { search: fileName });

if (listError || !fileList || fileList.length === 0) {
  throw new Error(`업로드 검증 실패: ${fileName}`);
}

// ✅ path만 저장
imageUrls.push(fileName);
```

**효과**:
- 업로드 실패 시 DB 저장 차단
- path 기반 저장으로 유연성 향상

---

### (2) 이미지 유틸리티 추가 (image-utils.js)

새 파일: `js/image-utils.js`

**주요 함수**:

1. **`getImagePublicUrl(path)`** - path → public URL 변환
```javascript
function getImagePublicUrl(path) {
  // 레거시 full URL도 호환
  if (path.startsWith('http')) return path;

  // path → public URL 생성
  const { data } = supabaseClient.storage
    .from('post-images')
    .getPublicUrl(path);

  return data.publicUrl;
}
```

2. **`extractImagePath(url)`** - full URL → path 추출
```javascript
function extractImagePath(url) {
  if (!url.startsWith('http')) return url;

  // URL에서 파일명만 추출
  const match = url.match(/\/post-images\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
```

3. **`normalizeImagePaths(imageData)`** - DB 데이터 → path 배열
```javascript
function normalizeImagePaths(imageData) {
  // JSON 파싱 + path 변환
  let paths = [];
  if (typeof imageData === 'string') {
    paths = JSON.parse(imageData);
  } else if (Array.isArray(imageData)) {
    paths = imageData;
  }

  return paths.map(extractImagePath).filter(Boolean);
}
```

---

### (3) 렌더링 코드 개선 (board.js, admin.js, main.js)

**변경 전**:
```javascript
// ❌ full URL 그대로 사용
let imageUrls = JSON.parse(post.image_url);
img.src = imageUrls[0]; // 404 가능
```

**변경 후**:
```javascript
// ✅ path → URL 변환 (레거시 호환)
const imagePaths = normalizeImagePaths(post.image_url);
const imageUrls = imagePaths.map(path => getImagePublicUrl(path));

img.src = imageUrls[0]; // 안전
```

---

### (4) Fallback 처리 추가

**변경 전**:
```javascript
img.onerror = () => {
  console.error('이미지 로드 실패');
  // 에러만 표시
};
```

**변경 후**:
```javascript
img.onerror = async () => {
  console.warn('⚠️  이미지 로드 실패');

  // HTTP 상태 코드 진단
  const response = await fetch(url, { method: 'HEAD' });
  if (response.status === 404) {
    console.warn('Storage에 파일이 없습니다');
  } else if (response.status === 403) {
    console.warn('버킷 권한 문제');
  }

  // ✅ Fallback 이미지 표시 (에러 throw 금지)
  loader.innerHTML = `
    <svg>...</svg>
    <p>이미지를 불러올 수 없습니다</p>
  `;
};
```

**효과**:
- 사용자에게 친화적인 UI
- 에러로 인한 페이지 중단 방지

---

### (5) 삭제 시 Storage 파일도 제거 (재발 방지)

**변경 전**:
```javascript
// ❌ path 추출 로직 복잡
for (const url of imageUrls) {
  const path = url.split('/').pop(); // 불안정
  await supabaseClient.storage
    .from('post-images')
    .remove([path]);
}
```

**변경 후**:
```javascript
// ✅ path 배열로 정규화 후 삭제
const imagePaths = normalizeImagePaths(imageUrlData);

for (const path of imagePaths) {
  const { error } = await supabaseClient.storage
    .from('post-images')
    .remove([path]);

  if (error) {
    console.warn('⚠️  이미지 삭제 실패:', path);
    // 에러 발생해도 계속 진행
  }
}
```

**효과**:
- 게시글 삭제 시 Storage 정리
- 404 에러 재발 방지

---

## 🔧 기존 데이터 마이그레이션

### 방법 1: 자동 마이그레이션 (권장)

`normalizeImagePaths()` 함수가 자동으로 처리:
- full URL → path 자동 변환
- 신규/레거시 데이터 모두 호환

### 방법 2: SQL로 일괄 변경 (선택)

Supabase Dashboard → SQL Editor:

```sql
-- image_url에서 path만 추출
UPDATE posts
SET image_url = regexp_replace(
  image_url,
  'https://[^/]+/storage/v1/object/public/post-images/',
  '',
  'g'
)
WHERE image_url LIKE '%storage/v1/object/public/post-images/%';

-- thumbnail_url도 동일하게
UPDATE posts
SET thumbnail_url = regexp_replace(
  thumbnail_url,
  'https://[^/]+/storage/v1/object/public/post-images/',
  '',
  'g'
)
WHERE thumbnail_url LIKE '%storage/v1/object/public/post-images/%';
```

---

## ✅ 검증 체크리스트

### 1. Supabase Dashboard 확인
- [ ] Storage → post-images 버킷에 파일 실제 존재
- [ ] 버킷이 **Public** 상태
- [ ] RLS 정책 확인 (SELECT: public, INSERT/DELETE: 관리자만)

### 2. 코드 테스트
- [ ] 이미지 업로드 → DB에 path만 저장되는지 확인
- [ ] 게시글 목록 → 썸네일 정상 표시
- [ ] 모달 열기 → 이미지들 정상 표시
- [ ] 404 에러 → Fallback UI 표시
- [ ] 게시글 삭제 → Storage 파일도 삭제

### 3. Console 로그 확인
```
✓ 이미지 업로드 성공: 1767577013749_fn0ljm.png
  Storage path: 1767577013749_fn0ljm.png

📦 이미지 paths: ["1767577013749_fn0ljm.png"]
✓ 이미지 URL 생성: https://...png

🗑️  삭제할 이미지 paths: ["1767577013749_fn0ljm.png"]
✓ 이미지 삭제 성공: 1767577013749_fn0ljm.png
```

---

## 🚨 문제 해결

### Q1. 여전히 404 에러 발생

**원인**: Storage에 파일이 실제로 없음

**해결**:
1. Supabase Dashboard → Storage → post-images 확인
2. 해당 파일이 있는지 확인
3. 없으면 게시글 다시 작성 + 이미지 재업로드

### Q2. 403 Forbidden 에러

**원인**: 버킷이 private 상태

**해결**:
1. Supabase Dashboard → Storage → post-images
2. "Configuration" 탭
3. "Public bucket" 활성화

### Q3. 레거시 데이터 오류

**원인**: 기존 full URL과 새 path가 혼재

**해결**:
- `normalizeImagePaths()` 자동 처리
- 또는 SQL로 일괄 변경 (위 참조)

---

## 📊 개선 효과

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| DB 저장 | full URL (200자) | path (50자) |
| 404 발생 | 업로드 실패 시 빈번 | 업로드 검증으로 방지 |
| 삭제 처리 | URL 파싱 복잡 | path 직접 사용 |
| 에러 처리 | 에러만 표시 | Fallback UI + 진단 |
| 유지보수 | URL 변경 시 DB 수정 | 프론트만 수정 |
