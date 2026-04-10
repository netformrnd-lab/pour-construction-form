/**
 * ============================================================
 * 넷폼알앤디 — Google Sheets 자동 저장 Apps Script
 * ============================================================
 *
 * [설정 방법]
 * 1. Google 스프레드시트를 새로 만든다
 * 2. 시트 2개 생성 (정확한 시트명):
 *    - "2604_백스코_박람회DB"  (박람회 고객메모 저장)
 *    - "NPS_드론조사"          (NPS 설문 응답 저장)
 * 3. 각 시트 1행에 아래 헤더를 입력 (복사-붙여넣기):
 *
 *    [2604_백스코_박람회DB 시트 헤더]
 *    저장시각 | 일자 | 담당자 | 성함 | 회사 | 직책 | 전화 | 이메일 | 건물유형 | 현장주소 | 문제유형 | 문제상세 | 관심항목 | 착공희망일 | 2차액션 | 메모 | 상태 | 출처
 *
 *    [NPS_드론조사 시트 헤더]
 *    제출시각 | 캠페인 | 성함 | 소속 | 연락처 | 직책 | NPS점수 | 구분 | 만족요인 | 개선요인 | 추가의견 | 출처
 *
 * 4. 스프레드시트 메뉴 → 확장 프로그램 → Apps Script 열기
 * 5. 이 코드 전체를 붙여넣고 저장
 * 6. 배포 → 새 배포 → 유형: "웹 앱"
 *    - 실행 사용자: "본인"
 *    - 액세스 권한: "모든 사용자" (익명 포함)
 * 7. 배포 URL을 복사
 * 8. index.html, NPS_Director_202604/index.html 의
 *    GOOGLE_SHEET_URL 변수에 붙여넣기
 * ============================================================
 */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet_type = payload._sheetType; // 'lead' 또는 'nps'
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (sheet_type === 'lead') {
      const sheet = ss.getSheetByName('2604_백스코_박람회DB');
      if (!sheet) return error('시트 "2604_백스코_박람회DB"를 찾을 수 없습니다');
      sheet.appendRow([
        payload.savedAt || new Date().toISOString(),
        payload.day || '',
        payload.staff || '',
        payload.name || '',
        payload.company || '',
        payload.position || '',
        payload.phone || '',
        payload.email || '',
        payload.building || '',
        payload.address || '',
        payload.problemCat || '',
        payload.problem || '',
        (payload.interests || []).join(', '),
        payload.desiredStartDate || '',
        (payload.nextActions || []).join(', '),
        payload.memo || '',
        payload.status || '신규',
        payload.source || '',
      ]);
    }
    else if (sheet_type === 'nps') {
      const sheet = ss.getSheetByName('NPS_드론조사');
      if (!sheet) return error('시트 "NPS_드론조사"를 찾을 수 없습니다');
      sheet.appendRow([
        payload.createdAt || new Date().toISOString(),
        payload.campaign || '',
        payload.name || '',
        payload.company || '',
        payload.phone || '',
        payload.position || '',
        payload.score,
        payload.category === 'promoter' ? '추천' : payload.category === 'passive' ? '중립' : '비추천',
        (payload.goodFactors || []).join(', '),
        (payload.badFactors || []).join(', '),
        payload.feedback || '',
        payload.source || '',
      ]);
    }
    else {
      return error('알 수 없는 sheetType: ' + sheet_type);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return error(err.toString());
  }
}

function error(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET 요청으로 동작 확인용
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: '넷폼알앤디 시트 연동 활성화됨' }))
    .setMimeType(ContentService.MimeType.JSON);
}
