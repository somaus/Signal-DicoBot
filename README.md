# Signal DicoBot

[Signal 서버](https://github.com/somaus/signal-server)의 기능을 디스코드에서 쓰는 봇 (TypeScript, discord.js).

## 명령어

| 명령어 | 설명 |
| --- | --- |
| `/탐지 이미지:<첨부>` | 딥페이크 탐지. 의심 이상이면 "도움받을 곳 보기" 버튼이 붙음 |
| `/위험도 이미지:<첨부>` | SNS 업로드 전 사진 위험도 진단(요인별 점수·권장 행동) |
| `/기관 [상황]` | 상황별(딥페이크/유포·불법촬영/위기) 도움 기관 안내 |
| `/상담 말하기·요약·종료` | 익명 상담 챗봇. 위기 감지 시 연락처를 강조, 종료하면 서버 기록 삭제 |

모든 응답은 본인에게만 보이는 메시지(ephemeral)다. 상담 세션은 봇 메모리에만 매핑을 두고(`saveConsent=false`), 재시작하면 새 세션이 열린다.

비로그인 5회 제한은 서버가 `X-Anonymous-Id: discord:<유저ID>` 기준으로 센다.

## 실행

```bash
cp .env.example .env   # 값 채우기
npm install
npm run deploy-commands  # 슬래시 명령어 등록
npm run dev
```
