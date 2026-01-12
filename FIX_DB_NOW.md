# 🔧 DB 이미지 데이터 완전 정리 스크립트

## 실행 방법

1. **admin.html 열기**
   ```
   https://portfolio-j-rust.vercel.app/admin.html
   ```

2. **로그인 필수!** (admin만 DB 수정 가능)

3. **F12 → Console 탭 열기**

4. **아래 스크립트 복사 → 붙여넣기 → Enter**

---

## ⚠️ 주의사항

이 스크립트는:
- ✅ **모든 게시글의 image_url을 null로 초기화**합니다
- ✅ 404 에러를 완전히 제거합니다
- ⚠️ 게시글 제목/내용은 유지됩니다
- ⚠️ Storage의 실제 파일은 삭제하지 않습니다 (나중에 재업로드 가능)
- ⚠️ 되돌릴 수 없습니다

---

## 🚀 DB 정리 스크립트

```javascript
(async function fixDBNow() {
  console.log('🔧 DB 이미지 데이터 완전 정리 시작...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. 모든 게시글 조회
    console.log('📋 Step 1: 모든 게시글 조회 중...');
    const { data: posts, error: postsError } = await supabaseClient
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (postsError) {
      console.error('❌ DB 조회 실패:', postsError.message);
      return;
    }

    console.log(`✓ 총 ${posts.length}개 게시글 발견\n`);

    // 2. 각 게시글 분석
    console.log('🔍 Step 2: 각 게시글 분석 중...\n');

    const needsCleanup = [];
    const alreadyClean = [];

    posts.forEach(post => {
      if (post.image_url) {
        needsCleanup.push({
          id: post.id,
          title: post.title
        });
      } else {
        alreadyClean.push(post.title);
      }
    });

    console.log(`📊 분석 결과:`);
    console.log(`   - 정리 필요: ${needsCleanup.length}개`);
    console.log(`   - 이미 깨끗함: ${alreadyClean.length}개\n`);

    if (needsCleanup.length === 0) {
      console.log('✅ 모든 게시글이 이미 깨끗합니다!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    // 3. 정리 실행
    console.log('🧹 Step 3: 이미지 데이터 정리 중...\n');

    let successCount = 0;
    let failCount = 0;

    for (const post of needsCleanup) {
      console.log(`   정리 중: "${post.title}"`);

      const { error } = await supabaseClient
        .from('posts')
        .update({
          image_url: null,
          thumbnail_url: null
        })
        .eq('id', post.id);

      if (error) {
        console.error(`   ❌ 실패: ${error.message}`);
        failCount++;
      } else {
        console.log(`   ✅ 완료`);
        successCount++;
      }
    }

    // 4. 최종 결과
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 최종 결과');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개\n`);

    if (successCount > 0) {
      console.log('🎉 DB 정리 완료!\n');
      console.log('다음 단계:');
      console.log('1. board.html 새로고침 (Cmd+Shift+R)');
      console.log('2. 모든 카드 클릭 → 404 에러 0개 확인');
      console.log('3. admin.html에서 이미지 다시 업로드\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    console.error('상세:', error.message);
  }
})();
```

---

## 실행 후 예상 결과

```
🔧 DB 이미지 데이터 완전 정리 시작...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 1: 모든 게시글 조회 중...
✓ 총 4개 게시글 발견

🔍 Step 2: 각 게시글 분석 중...

📊 분석 결과:
   - 정리 필요: 4개
   - 이미 깨끗함: 0개

🧹 Step 3: 이미지 데이터 정리 중...

   정리 중: "타타타 베이커리"
   ✅ 완료
   정리 중: "SIYAZU(시야주)"
   ✅ 완료
   정리 중: "논픽션"
   ✅ 완료
   정리 중: "포크플랜"
   ✅ 완료

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 최종 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 성공: 4개
❌ 실패: 0개

🎉 DB 정리 완료!

다음 단계:
1. board.html 새로고침 (Cmd+Shift+R)
2. 모든 카드 클릭 → 404 에러 0개 확인
3. admin.html에서 이미지 다시 업로드

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 이후 작업

### 1. 404 에러 확인
- board.html 새로고침
- 모든 Work 카드 클릭
- Network 탭에서 404 = 0 확인

### 2. 이미지 다시 업로드
- admin.html 로그인
- 각 게시글 수정
- 이미지 다시 업로드

---

## 지금 바로 실행하세요!

**admin.html → 로그인 → Console → 스크립트 붙여넣기 → Enter**
