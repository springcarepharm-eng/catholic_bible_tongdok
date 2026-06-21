# 신규 기능 개발 명세 — 밤의 통독 (FEATURES_SPEC.md)

> VS Code에서 Claude Code에게: **"이 FEATURES_SPEC.md를 보고 Phase 1부터 차례대로 구현해줘. 한 기능씩, 끝나면 멈추고 확인받아."** 라고 지시하세요.
> 이 문서는 `CLAUDE.md`(프로젝트 컨텍스트)와 함께 사용합니다. 충돌하면 `CLAUDE.md`의 '제약'이 우선.

---

## 0. 절대 규칙 (어기지 말 것)
1. **성경 본문을 코드/저장소/클라우드에 저장하지 않는다.** 본문은 사용자의 로컬 `.txt`에서 런타임 로드 → 기기(IndexedDB)에만 보관.
2. **묵상·강론·구절 기록은 절대 클라우드로 보내지 않는다.** 동기화는 **'진도(읽은 날)'만**. 묵상은 기기에만 남는다.
3. 기존 사용자가 매일 쓰는 중이므로, 데이터 구조를 바꿀 땐 **마이그레이션**으로 기존 기록을 보존한다.
4. 가톨릭 교리 관련 문구는 권위 있는 출처 기준, 단정 대신 확인 권고.

## 0.1 기존 구조 (현재 `index.html`)
- 단일 파일 앱. localStorage + IndexedDB.
- `tg_state` = `{ reminderTime, completed:[dayNum...] }`
- `tg_entries` = `{ [day]: { med, verse, savedAt } }`  ← 묵상(로컬 전용)
- `tg_notes` = `{ [day]: { bg, homily } }`  ← 배경·강론 보관(로컬 전용)
- IndexedDB `tongdok_db`/store `kv`/key `bible` = 본문 원문
- 통독 플랜: `BOOKS`(73권) → `flat[[bookIndex,chapter]]` → 365일 분할. `currentDay()` = 완료 안 한 가장 빠른 day. `fmt(slice)`, `parseBible(text)`, `render()`, `bind()` 존재.

## 0.2 공통 데이터 변경 + 마이그레이션 (Phase 1 시작 시 1회)
`tg_state`에 두 필드 추가:
- `startDate`: 최초 사용일(ISO `YYYY-MM-DD`, 로컬). 없으면 오늘로 설정.
- `completedDates`: `{ [day]: "YYYY-MM-DD" }` — 각 day를 '완료 처리한 날짜'.

**마이그레이션:** 앱 로드 시 `completedDates`가 없으면 생성하고, 기존 `completed`의 각 day에 대해 `entries[day].savedAt`의 날짜로 채운다(없으면 `startDate`로). 이후 '저장하고 읽음 표시' 시 `completedDates[day] = 오늘`, '읽음 취소' 시 해당 키 삭제.

---

# Phase 1 — 오프라인 기능 (서버 불필요, 먼저 구현)

## 기능 ② 백업 / 복원
**목적:** 묵상·진도를 파일로 내보내고 되돌리기. 기기 교체·데이터 유실 대비, 아내 폰으로 옮길 때도 사용.

**동작**
- **내보내기:** `{ app:"bam-tongdok", version:1, exportedAt, state, entries, notes }`를 JSON으로 만들어 `bam-tongdok-backup-YYYYMMDD.json` 다운로드. **본문(bible)은 포함하지 않는다**(용량 + 저작권; 복원 후 .txt 재로딩).
- **불러오기:** `.json` 선택 → 파싱·검증 → 기존 데이터와 **병합**:
  - `completed`: 합집합(union)
  - `completedDates`: 합치되 충돌 시 더 이른 날짜 유지
  - `entries`/`notes`: day별 병합, 충돌 시 `savedAt`이 더 최신인 쪽 사용
  - 병합 전 "덮어쓸까요/합칠까요" 확인. 잘못된 파일이면 alert 후 중단.
- 완료 후 저장 + `render()`.

**UI:** 하단 설정 영역에 '백업' 패널 → [내보내기] [불러오기] 버튼 + 한 줄 설명("본문은 백업에 포함되지 않아요").

**완료 기준:** 내보낸 파일을 다른 기기에서 불러오면 진도·묵상이 복원된다. 본문은 미포함. 오프라인 동작.

## 기능 ③ 달력 + 완료/미완료
**목적:** 읽고 묵상한 날을 한눈에. 응원/지속 동기.

**핵심 개념 (그대로 구현):** '밀림'은 이미 작동한다 — 콘텐츠는 완료해야만 다음으로 넘어가므로(`currentDay()`), 못한 날의 분량은 사라지지 않고 자동으로 이어진다. **달력은 날짜↔분량을 새로 묶는 게 아니라 '완료 기록'을 보여주는 뷰일 뿐이다.** (날짜에 분량을 고정 배정하지 말 것.)

**동작 / 표시 규칙 (날짜별)**
- `completedDates`의 값에 그 날짜가 있으면 → **✓ 완료**(금빛). 같은 날 2개 이상 완료면 작은 숫자 배지.
- 그 외, `startDate` ≤ 날짜 < 오늘 인데 완료 없음 → **미완료**(은은한 점/얇은 링; **빨강·경고색 금지**, 다그치지 않게).
- 오늘 → 강조 테두리. 미래 → 표시 없음.
- 완료된 날짜 탭 → 해당 day로 이동(`viewDay`)해 그날 묵상 다시 보기.

**UI:** 월 단위 그리드(요일 헤더 + 날짜 셀), 이전/다음 달 이동(범위: `startDate`의 달 ~ 현재 달). 야간 테마 토큰 사용.

**완료 기준:** 완료한 날 ✓, 건너뛴 과거 날 은은한 미완료, 오늘 강조, 완료 날 탭 시 그날 묵상 열림. 하루 걸러도 콘텐츠는 안 사라짐.

## 기능 ④ 인덱스 (아무 데나 펼쳐 보기)
**목적:** 통독 순서와 별개로 원하는 책·장을 바로 열람.

**동작**
- 책 선택(73권, `BOOKS` 이름) → 장 선택(1..해당 권 장수) → 그 장의 절을 `fileBooks`에서 렌더(기존 본문 렌더 재사용).
- **진도·완료에 영향 없음**(읽기 전용 브라우즈). '통독으로 돌아가기' 제공.
- 본문 미로딩 시 파일 불러오기 안내.
- (선택) 참조 입력창: "창세 3" 같은 입력 파싱해 점프.

**UI:** 상단에 모드 토글 또는 '📖 펼쳐보기' 진입 버튼 → 책 드롭다운 + 장 그리드 + 본문.

**완료 기준:** 임의의 책·장을 열람 가능, 진도 변화 없음, 통독 화면 복귀 가능.

---

# Phase 2 — 진도 동기화 (Supabase + Vercel) ※ 사용자 계정/키 필요

**원칙 재확인:** **진도만** 동기화. `entries`/`notes`(묵상·강론·구절)는 **절대 전송 금지**, 기기에만.

**왜 서버 코드가 없어도 되나:** Supabase의 **anon key는 공개돼도 안전**(설계상 공개용, RLS로 보호). 클라이언트에서 직접 Supabase를 호출하면 되므로 별도 서버리스 함수 불필요. ⚠️ **service_role key는 절대 클라이언트/저장소에 넣지 말 것.**

## 데이터 모델 (Supabase Postgres)
가구(`household`) 안에 사람(`member`)별 1행.
```sql
create table progress (
  household        text not null,
  member           text not null,            -- 예: '남편' / '아내' 또는 이름
  completed_days   jsonb not null default '[]',   -- [dayNum...]
  completed_dates  jsonb not null default '{}',   -- { "12":"2026-06-18", ... }
  reading_day      int  not null default 1,       -- currentDay()
  updated_at       timestamptz not null default now(),
  primary key (household, member)
);
alter table progress enable row level security;
```

### 보안 방식 — 두 단계 중 선택
**v1 (MVP, 권장 시작): 로그인 없음 + 가구 코드**
- 두 사람이 같은 **가구 코드**(추측 어려운 긴 무작위 문자열)를 앱에 한 번 입력. 행을 `(household, member)`로 식별.
- 정책(익명 허용 — 저장 데이터가 '진도'뿐이라 민감도 낮음):
```sql
create policy "mvp anon all" on progress for all using (true) with check (true);
```
- ⚠️ **트레이드오프(꼭 인지):** anon + 위 정책이면 테이블이 사실상 공개 읽기/쓰기. 보호는 '추측 어려운 가구 코드' + '진도만 저장'에 의존. 묵상은 어차피 클라우드에 없음. 더 강한 보안은 v2.

**v2 (보안 업그레이드, 선택): Supabase Auth + RLS**
- 각자 이메일 매직링크 로그인. 행에 `user_id uuid default auth.uid()` 추가, PK를 `user_id`로.
- RLS 재귀를 피하려 security definer 함수 사용:
```sql
create or replace function my_household() returns text
  language sql security definer stable as
$$ select household from progress where user_id = auth.uid() limit 1 $$;

create policy "read same household" on progress for select using (household = my_household());
create policy "insert own" on progress for insert with check (user_id = auth.uid());
create policy "update own" on progress for update using (user_id = auth.uid());
```

## 클라이언트 연동 (정적 HTML에 그대로)
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```
```js
const SUPABASE_URL = "https://xxxx.supabase.co";   // 공개 가능
const SUPABASE_ANON_KEY = "ey...";                  // anon key, 공개 가능
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 로컬에 동기화 설정 저장: tg_state.sync = { household, member, enabled:true }

// 내 진도 올리기 (완료/취소 시 호출)
async function pushProgress(){
  if(!state.sync?.enabled) return;
  await sb.from('progress').upsert({
    household: state.sync.household, member: state.sync.member,
    completed_days: state.completed, completed_dates: state.completedDates,
    reading_day: currentDay(), updated_at: new Date().toISOString()
  });
}
// 가구 전체(나+배우자) 진도 가져오기 (로드 시)
async function pullHousehold(){
  if(!state.sync?.enabled) return [];
  const { data } = await sb.from('progress').select('*').eq('household', state.sync.household);
  return data || [];   // 달력에 배우자 ✓ 오버레이용
}
```

## 동기화 동작
- **로컬 우선(offline-first):** 내 진도의 정답은 항상 로컬. 완료/취소 시 로컬 저장 후 온라인이면 `pushProgress()`. 오프라인이면 건너뛰고 다음 로드 때 반영.
- **로드 시:** `pullHousehold()`로 배우자 행을 받아 달력에 "아내 ✓"처럼 겹쳐 표시(색/아이콘 구분). 충돌 없음(각자 자기 행만 씀).
- **첫 설정 UI:** '함께 보기' 패널 → 이름(남편/아내) + 가구 코드 입력 → `tg_state.sync` 저장. 끄기 가능.

## 사용자가 직접 해야 하는 셋업 (Claude Code가 대신 못 함)
1. **Supabase**: supabase.com 무료 프로젝트 생성 → SQL Editor에서 위 테이블·정책 실행 → Project URL + anon key 복사해 클라이언트에 입력.
2. **Vercel 배포(원하면)**: vercel.com → Add New → Project → 이 GitHub 저장소 Import → Framework Preset **Other** → Deploy(정적이라 빌드 설정 불필요). 나오는 `*.vercel.app` 주소를 아이폰 Safari에서 홈 화면에 추가.
   - anon key는 하드코딩해도 안전하므로 환경변수 없이도 동작(원하면 Vercel Settings → Environment Variables 사용).
   - (GitHub Pages를 계속 써도 Supabase 동기화는 똑같이 동작함.)
3. 두 사람이 같은 **가구 코드** 입력 → 끝.

## 완료 기준
- 두 사람이 각자 자기 진도를 기록하고, 달력에서 서로의 진도(✓)를 본다.
- **묵상은 클라우드에 절대 올라가지 않는다**(전송 경로 자체가 없어야 함).
- 오프라인에서도 내 진도는 정상 동작, 온라인 복귀 시 반영.

---

## 권장 순서
1. 0.2 공통 데이터 변경 + 마이그레이션
2. ② 백업/복원 (간단, 안전)
3. ④ 인덱스 (간단)
4. ③ 달력 (마이그레이션·completedDates 활용)
5. ① 동기화 v1(MVP) → 잘 되면 v2(Auth) 업그레이드

각 단계는 독립 커밋. Phase 2 전까지는 인터넷 없이 전부 동작해야 함.
