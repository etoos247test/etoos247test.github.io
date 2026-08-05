const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export function extensionFor(contentType) {
  const value = EXTENSIONS[contentType];
  if (!value) throw new Error('지원하지 않는 이미지 형식입니다.');
  return value;
}

export function buildAttachmentKey({ campus, createdAt, questionId, messageId, attachmentId, contentType }) {
  if (!['suseong1', 'suseong2'].includes(campus)) throw new Error('유효하지 않은 소속관입니다.');
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) throw new Error('유효하지 않은 저장 시각입니다.');

  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const extension = extensionFor(contentType);

  // 개인정보를 경로에 넣지 않는다. 이 경로는 운영과 NAS 백업에서 영구 식별자로 사용한다.
  return `qa/v1/${campus}/${year}/${month}/${questionId}/${messageId}/${attachmentId}.${extension}`;
}
