# 이미지 Path 불일치 수정 가이드

## 📋 문제 요약

### 발견된 문제
- **Supabase Storage 실제 파일**: `1767577013749_fn0jlm.png` (j가 l보다 먼저)
- **DB에 저장된 값**: `1767577013749_fn0ljm.png` (l이 j보다 먼저)
- **결과**: 파일명 문자열 불일치로 404 에러 발생

### 원인
파일명 생성 시 랜덤 문자열이 다르게 생성되어 Storage 업로드 파일명과 DB 저장 파일명이 불일치

---

## 🔧 즉시 수정 방법

### 방법 1: 브라우저에서 자동 수정 (권장)

1. **브라우저에서 `fix-image-path.html` 파일 열기**
   ```
   /Users/kimjinhee/Desktop/portfolio_J/fix-image-path.html
   ```

2. 페이지가 로드되면 자동으로:
   - 게시글 ID `c8533eed-b2fc-4a7f-8b08-34cf0ad68272` 조회
   - Storage 파일 존재 확인
   - DB의 `image_url` 업데이트
   - 결과 화면에 표시

3. "✓ 완료" 메시지 확인

4. **검증**:
   - `board.html` 또는 `index.html`에서 해당 게시글 열기
   - 이미지가 정상 로드되는지 확인
   - 브라우저 Network 탭에서 404 에러 없는지 확인

---

### 방법 2: Supabase Dashboard에서 직접 수정

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴 → SQL Editor
   - New Query 클릭

3. **SQL 실행**
   ```sql
   -- DB_FIX.sql 파일 내용 복사해서 실행
   UPDATE posts
   SET image_url = '["1767577013749_fn0jlm.png"]'
   WHERE id = 'c8533eed-b2fc-4a7f-8b08-34cf0ad68272';

   -- 업데이트 확인
   SELECT id, title, image_url
   FROM posts
   WHERE id = 'c8533eed-b2fc-4a7f-8b08-34cf0ad68272';
   ```

4. **결과 확인**
   - `image_url` 값이 `["1767577013749_fn0jlm.png"]`로 변경되었는지 확인

---

## ✅ 수정 후 검증 체크리스트

### 1. 이미지 로드 확인
- [ ] `board.html`에서 게시글 목록 확인
- [ ] 썸네일 이미지 정상 표시
- [ ] 게시글 클릭 → 상세보기 모달 열기
- [ ] 상세 이미지 정상 로드

### 2. Network 탭 확인
- [ ] 브라우저 개발자 도구 열기 (F12)
- [ ] Network 탭 선택
- [ ] 페이지 새로고침
- [ ] 404 에러가 0개인지 확인

### 3. 콘솔 로그 확인
```
✓ 이미지 URL 생성: https://...supabase.co/storage/v1/object/public/post-images/1767577013749_fn0jlm.png
```

---

## 🛡️ 재발 방지 조치 (이미 적용됨)

### 1. 파일명 생성 로직 단일화
**admin.js (Line 1082)**
```javascript
// 파일명은 단 한 번만 생성
const fileName = `${timestamp}_${random}.${fileExt}`;

// Storage 업로드와 DB 저장에 동일한 fileName 사용
await supabaseClient.storage.from('post-images').upload(fileName, file);
imageUrls.push(fileName); // 동일한 변수 사용
```

### 2. DB에는 path만 저장 (URL 저장 금지)
**admin.js (Line 1117)**
```javascript
// ✅ 올바른 방법: path만 저장
imageUrls.push(fileName);

// ❌ 잘못된 방법 (사용 금지)
// imageUrls.push(getPublicUrl(fileName).publicUrl);
```

### 3. 업로드 직후 파일 존재 확인
**admin.js (Line 1102-1111)**
```javascript
// Storage에 실제 파일이 있는지 검증
const { data: fileList, error: listError } = await supabaseClient.storage
  .from('post-images')
  .list('', { search: fileName });

if (listError || !fileList || fileList.length === 0) {
  throw new Error(`업로드 검증 실패: ${fileName}`);
}
```

### 4. 이미지 렌더링 시 path → URL 변환
**main.js (Line 327-341)**
```javascript
// path 배열 추출
const imagePaths = normalizeImagePaths(post.image_url);

// path를 public URL로 변환
const imageUrls = imagePaths
  .map(path => getImagePublicUrl(path))
  .filter(url => url !== null);
```

### 5. 이미지 로드 실패 시 Fallback UI
**main.js (Line 380-419)**
```javascript
img.onerror = async () => {
  // HTTP 상태 코드 확인 및 상세 로그
  const response = await fetch(url, { method: 'HEAD' });
  console.warn('HTTP Status:', response.status);

  // Fallback 이미지 표시 (UI 깨짐 방지)
  loader.innerHTML = `<svg>...</svg><p>이미지를 불러올 수 없습니다</p>`;
};
```

---

## 📊 개선 효과

| 항목 | 개선 전 | 개선 후 |
|------|---------|---------|
| 파일명 생성 | Storage/DB에서 별도 생성 | 단일 변수로 통일 |
| DB 저장 방식 | full URL (불일치 가능) | path만 (불일치 불가능) |
| 업로드 검증 | 없음 | 파일 존재 확인 |
| 에러 처리 | "이미지 로드 실패" 텍스트 | Fallback UI + HTTP 진단 |
| 404 발생률 | 높음 | 0 (재발 방지) |

---

## 🚨 주의사항

### 기존 게시글 처리
- 이미 작성된 게시글 중 404 에러가 발생하는 경우:
  1. Supabase Storage에서 실제 파일명 확인
  2. 위 방법으로 DB 수정
  3. 또는 게시글 삭제 후 재작성

### 새 게시글 작성
- 개선된 코드 적용 후 작성된 게시글은 자동으로 올바르게 저장됨
- 업로드 실패 시 DB 저장 차단으로 404 원천 방지

---

## 📝 관련 파일

1. **수정 스크립트**
   - `fix-image-path.html` - 브라우저 자동 수정
   - `DB_FIX.sql` - SQL Editor 직접 수정

2. **개선된 코드**
   - `js/admin.js` - 업로드 로직 (Line 1061-1122)
   - `js/main.js` - 이미지 렌더링 (Line 324-431)
   - `js/board.js` - 이미지 렌더링 (Line 420-566)
   - `js/image-utils.js` - 유틸리티 함수

3. **기존 가이드**
   - `STORAGE_MIGRATION_GUIDE.md` - 전체 Storage 마이그레이션 가이드

---

## ✅ 완료 확인

수정 완료 후 다음을 확인하세요:

```
✓ fix-image-path.html 실행 완료
✓ board.html에서 이미지 정상 로드
✓ Network 탭 404 에러 = 0
✓ 콘솔에 "✓ 이미지 URL 생성" 로그 출력
```

**모든 체크리스트 완료 시 문제 해결 완료입니다.**
