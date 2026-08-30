/* Firestore 방명록 저장소입니다.
   설정값은 빌드 시 NEXT_PUBLIC_FIREBASE_* 환경변수로 주입됩니다.
   Firebase 웹 설정값은 비밀키가 아니라 프로젝트 식별자이며, 배포된 JS 에 그대로 들어가는 것이
   정상적인 사용법입니다. 실제 접근 제어는 firestore.rules 가 담당합니다. */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Timestamp
} from "firebase/firestore";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

/* 설정이 없으면 Firestore 를 쓰지 않고, 화면은 linktree.ts 의 예시 방명록으로 대체됩니다. */
export const isGuestbookEnabled = Boolean(config.apiKey && config.projectId);

export const GUESTBOOK_LIMITS = { author: 20, text: 100 } as const;

export type RemoteEntry = {
  id: string;
  author: string;
  text: string;
  date: string;
  /* 쓴 사람의 구글 uid 입니다. 본인 글에만 삭제 버튼을 보여 주는 데 씁니다. */
  uid: string;
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function getApp() {
  if (!app) app = getApps()[0] ?? initializeApp(config as Record<string, string>);
  return app;
}

function getDb() {
  if (!isGuestbookEnabled) return null;
  if (!db) db = getFirestore(getApp());
  return db;
}

function getAuthInstance() {
  if (!isGuestbookEnabled) return null;
  if (!auth) auth = getAuth(getApp());
  return auth;
}

/* ---------------------------------------------------------------
   구글 로그인. 방명록에 글을 남기려면 로그인이 되어 있어야 합니다
   (스팸/도배 방지용 잠금이고, 이름은 로그인과 상관없이 직접 적습니다).
   --------------------------------------------------------------- */

export function subscribeAuthState(onChange: (user: User | null) => void) {
  const instance = getAuthInstance();
  if (!instance) {
    onChange(null);
    return () => {};
  }
  return onAuthStateChanged(instance, onChange);
}

export async function signInWithGoogle() {
  const instance = getAuthInstance();
  if (!instance) throw new Error("로그인 기능이 설정되지 않았습니다.");
  await signInWithPopup(instance, new GoogleAuthProvider());
}

export async function signOutOfGoogle() {
  const instance = getAuthInstance();
  if (!instance) return;
  await signOut(instance);
}

function formatDate(value: unknown) {
  const date = value && typeof (value as Timestamp).toDate === "function"
    ? (value as Timestamp).toDate()
    : new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

/* ---------------------------------------------------------------
   미니홈피 왼쪽 위 TODAY / TOTAL 방문 수입니다.
   counters/site 문서 하나에 total, today, day 를 담아 둡니다.
   --------------------------------------------------------------- */

/* 방명록과 같은 Firebase 설정을 씁니다. */
export const isCounterEnabled = isGuestbookEnabled;

export type VisitCounts = { total: number; today: number };

/* 하루 경계를 방문자 시간대가 아니라 한국 시간으로 맞춥니다. 2026-08-14 형태입니다. */
function seoulDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/* 방문 한 번을 기록하고 갱신된 값을 돌려줍니다.
   읽기와 쓰기를 한 트랜잭션으로 처리해서 동시에 들어와도 숫자가 어긋나지 않습니다. */
export async function recordVisit(): Promise<VisitCounts> {
  const store = getDb();
  if (!store) throw new Error("방문 수 기능이 설정되지 않았습니다.");

  const ref = doc(store, "counters", "site");
  const day = seoulDay();

  return runTransaction(store, async transaction => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists()) {
      const first = { total: 1, today: 1, day };
      transaction.set(ref, first);
      return { total: first.total, today: first.today };
    }

    const data = snapshot.data();
    const total = Number(data.total ?? 0) + 1;
    /* 날짜가 바뀐 뒤 첫 방문이면 오늘 수를 다시 1부터 셉니다. */
    const today = data.day === day ? Number(data.today ?? 0) + 1 : 1;

    transaction.update(ref, { total, today, day });
    return { total, today };
  });
}

/* 방명록을 실시간으로 구독합니다. 정리 함수를 돌려줍니다. */
export function subscribeGuestbook(
  count: number,
  onData: (entries: RemoteEntry[]) => void,
  onError: (error: Error) => void
) {
  const store = getDb();
  if (!store) return () => {};

  const q = query(collection(store, "guestbook"), orderBy("createdAt", "desc"), fsLimit(count));
  return onSnapshot(
    q,
    snapshot => {
      onData(
        snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            author: String(data.author ?? ""),
            text: String(data.text ?? ""),
            date: formatDate(data.createdAt),
            uid: String(data.uid ?? "")
          };
        })
      );
    },
    error => onError(error as Error)
  );
}

export async function addGuestbookEntry(author: string, text: string) {
  const store = getDb();
  if (!store) throw new Error("방명록 기능이 설정되지 않았습니다.");
  const user = getAuthInstance()?.currentUser;
  if (!user) throw new Error("구글 로그인 후 남길 수 있어요.");

  const trimmedAuthor = author.trim();
  const trimmedText = text.trim();

  if (!trimmedAuthor || !trimmedText) throw new Error("이름과 방명록을 모두 적어 주세요.");
  if (trimmedAuthor.length > GUESTBOOK_LIMITS.author) throw new Error(`이름은 ${GUESTBOOK_LIMITS.author}자까지 쓸 수 있어요.`);
  if (trimmedText.length > GUESTBOOK_LIMITS.text) throw new Error(`방명록은 ${GUESTBOOK_LIMITS.text}자까지 쓸 수 있어요.`);

  /* approved 는 지금은 항상 true 입니다. 나중에 승인제로 바꾸려면
     이 값을 false 로 두고 firestore.rules 의 read 조건만 바꾸면 됩니다. */
  await addDoc(collection(store, "guestbook"), {
    author: trimmedAuthor,
    text: trimmedText,
    approved: true,
    createdAt: serverTimestamp(),
    uid: user.uid
  });
}

/* 본인이 쓴 글만 지울 수 있습니다 (firestore.rules 에서도 같은 조건을 확인합니다). */
export async function deleteGuestbookEntry(id: string) {
  const store = getDb();
  if (!store) throw new Error("방명록 기능이 설정되지 않았습니다.");
  if (!getAuthInstance()?.currentUser) throw new Error("구글 로그인 후 지울 수 있어요.");
  await deleteDoc(doc(store, "guestbook", id));
}
