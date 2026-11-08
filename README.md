# Signal DicoBot

[Signal 서버](https://github.com/somaus/signal-server)의 기능을 디스코드에서 쓰는 봇 (TypeScript, discord.js).

## 명령어

| 명령어 | 설명 |
| --- | --- |
| `/탐지 이미지:<첨부>` | 딥페이크 탐지 API 호출. 결과는 본인에게만 보임(ephemeral) |

비로그인 5회 제한은 서버가 `X-Anonymous-Id: discord:<유저ID>` 기준으로 센다.

## 실행

```bash
cp .env.example .env   # 값 채우기
npm install
npm run deploy-commands  # 슬래시 명령어 등록
npm run dev
```
