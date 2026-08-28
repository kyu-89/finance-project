# 우리집 가계부

기존 Excel 가계부에 분산되어 있는 수입·지출·예산·결산·카드·계좌·예적금·대출·보험·정부지원금·경조사·투자·자산 정보를 하나의 개인 재무 데이터베이스로 통합하고, 모바일에서 빠르게 기록하며 PC에서 깊게 분석할 수 있는 개인 재무관리 웹 서비스입니다.

## 로컬 실행

1. 의존성 설치

   ```bash
   npm install
   ```

2. 환경 변수 설정

   `.env.local.example`을 복사해 `.env.local`을 만들고, 값을 채웁니다.

   ```bash
   cp .env.local.example .env.local
   ```

   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 Supabase 프로젝트 설정에서 확인할 수 있습니다. `.env.local`은 `.gitignore`에 포함되어 있으므로 커밋되지 않습니다.

3. 개발 서버 실행

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000)에서 확인합니다.

## 테스트

```bash
npm test
```

`tests/integration/`에는 실제 Supabase 프로젝트에 대해 RLS 정책을 검증하는 통합 테스트가 포함되어 있습니다. 이 테스트를 실행하려면 실제 `SUPABASE_SERVICE_ROLE_KEY`가 필요하며, 이 키는 절대 커밋해서는 안 됩니다. 프로젝트 루트에 `.env.test.local` 파일을 만들어(이미 `.gitignore`에 포함되어 있습니다) 다음 값을 채워 넣으세요.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하는 관리자 키이므로 절대 클라이언트 번들에 포함되거나 저장소에 커밋되어서는 안 됩니다.

## 배포 (Vercel)

Vercel 프로젝트에 다음 환경 변수를 설정합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

또한 Supabase 프로젝트의 Authentication 설정에서 **Site URL**과 **Redirect URLs**에 운영 도메인을 추가해야 이메일 확인/비밀번호 재설정 링크가 올바른 origin으로 돌아옵니다.

Vercel의 Preview 배포는 매번 다른 `*.vercel.app` origin을 가지므로 기본적으로는 Supabase의 Redirect URL 허용 목록에 포함되지 않습니다. 다음 중 하나로 대응하세요.

- Supabase 플랜에서 와일드카드 Redirect URL 패턴(예: `https://*-your-team.vercel.app/**`)을 지원한다면 이를 추가합니다.
- 와일드카드를 사용할 수 없다면, Preview URL 자체를 Vercel Deployment Protection으로 보호하여 인증되지 않은 사용자가 Preview 배포에 접근하지 못하도록 합니다.

PRD §29 체크리스트의 요구사항대로, Vercel Preview URL이라도 인증 없이는 데이터에 접근할 수 없어야 합니다.
