-- ==========================================
-- 이미지 Path 불일치 수정
-- ==========================================
-- 문제: DB에 저장된 파일명과 Storage의 실제 파일명이 다름
-- 원인: 파일명 문자열 불일치 (l/j 순서 오류)
-- 해결: 실제 Storage 파일명으로 DB 업데이트
-- ==========================================

-- 게시글 ID: c8533eed-b2fc-4a7f-8b08-34cf0ad68272
-- 실제 Storage 파일: 1767577013749_fn0jlm.png
-- 잘못된 DB 값: 1767577013749_fn0ljm.png

UPDATE posts
SET image_url = '["1767577013749_fn0jlm.png"]'
WHERE id = 'c8533eed-b2fc-4a7f-8b08-34cf0ad68272';

-- 업데이트 확인
SELECT id, title, image_url
FROM posts
WHERE id = 'c8533eed-b2fc-4a7f-8b08-34cf0ad68272';
