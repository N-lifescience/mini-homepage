"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BlockList } from "./Editable";
import { newId, type BoardPost, type SiteContent, type SiteContentState, type TabDef } from "@/lib/site-content";

type Section = "profile" | "tabs" | "content" | "waves";
const sections: { id: Section; label: string; detail: string; icon: string }[] = [
  { id: "profile", label: "기본 정보", detail: "이름과 소개 문구", icon: "✎" },
  { id: "tabs", label: "탭 관리", detail: "이름·순서", icon: "▤" },
  { id: "content", label: "글과 사진", detail: "탭에 담을 내용", icon: "▧" },
  { id: "waves", label: "파도타기", detail: "자주 가는 링크", icon: "↗" }
];

function Field({ label, value, onChange, multiline, type = "text", hint, required }: {
  label: string; value: string; onChange: (value: string) => void;
  multiline?: boolean; type?: string; hint?: string; required?: boolean;
}) {
  const id = useId();
  const shared = { id, value, required, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <div className="admin-field">
    <label htmlFor={id}>{label}{required ? <span className="admin-required">필수</span> : null}</label>
    {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} type={type} />}
    {hint ? <p>{hint}</p> : null}
  </div>;
}

function OrderTools({ index, count, onMove, onRemove, locked = false }: {
  index: number; count: number; onMove: (delta: number) => void; onRemove?: () => void; locked?: boolean;
}) {
  return <div className="admin-order">
    <button type="button" aria-label="위로 이동" disabled={locked || index === 0} onClick={() => onMove(-1)}>↑</button>
    <button type="button" aria-label="아래로 이동" disabled={locked || index === count - 1} onClick={() => onMove(1)}>↓</button>
    {onRemove ? <button type="button" className="admin-danger" onClick={onRemove}>삭제</button> : null}
  </div>;
}

function reorder<T>(list: T[], index: number, delta: number): T[] {
  const copy = [...list];
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

export default function AdminEditor({ state, images, initialTabId, onPreview, onClose }: {
  state: SiteContentState; images: Record<string, string>; initialTabId: string;
  onPreview: (tabId: string) => void; onClose: () => void;
}) {
  const { content, update, saveStatus, dirty } = state;
  const [section, setSection] = useState<Section>("content");
  const editableTabs = content.tabs.filter(tab => !["home", "oekaki", "guestbook"].includes(tab.kind));
  const [tabId, setTabId] = useState(initialTabId);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const tab = editableTabs.find(item => item.id === tabId) ?? editableTabs[0];
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const busy = saveStatus === "saving" || uploading;
  const setProfile = (patch: Partial<SiteContent["profile"]>) => update({ profile: { ...content.profile, ...patch } });

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; returnFocus.current?.focus(); };
  }, []);

  const save = async () => { if (!busy) await state.save(); };
  const discard = () => {
    if (busy) return;
    if (!dirty || window.confirm("저장하지 않은 변경을 취소할까요?")) { state.discard(); onClose(); }
  };
  const preview = () => { if (!busy) onPreview(section === "content" ? tab?.id ?? "home" : "home"); };

  const renameTab = (id: string, patch: Partial<TabDef>) => update({ tabs: content.tabs.map(item => item.id === id ? { ...item, ...patch } : item) });
  const removeTab = (item: TabDef) => {
    if (!window.confirm(`‘${item.label}’ 탭과 그 안의 내용을 삭제할까요? 저장 전에는 되돌릴 수 있어요.`)) return;
    const blocks = { ...content.blocks };
    delete blocks[item.id];
    update({ tabs: content.tabs.filter(t => t.id !== item.id), blocks });
  };
  const setPost = (id: string, patch: Partial<BoardPost>) => update({ boardPosts: content.boardPosts.map(post => post.id === id ? { ...post, ...patch } : post) });
  const addPost = () => update({ boardPosts: [{ id: newId("post"), title: "", category: "앱", summary: "", date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }), href: "" }, ...content.boardPosts] });
  const selected = sections.find(item => item.id === section)!;

  return <div className="admin-overlay">
    <div ref={dialogRef} className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="admin-title" tabIndex={-1}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || dialogRef.current?.querySelector(".cy-viewer")) return;
        if (event.key === "Escape") { event.preventDefault(); preview(); }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
        if (event.key === "Tab") {
          const fields = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []).filter(item => item.getClientRects().length);
          const first = fields[0], last = fields.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="admin-head">
        <div className="admin-brand"><span className="admin-mark">N</span><div><span className="admin-eyebrow">MY MINI HOMEPAGE</span><h1 id="admin-title">미니홈피 편집</h1></div></div>
        <button type="button" className="admin-quiet" disabled={busy} onClick={preview}>미리보기 <span aria-hidden="true">↗</span></button>
      </header>
      <div className="admin-workspace">
        <nav className="admin-nav" aria-label="편집 메뉴">
          {sections.map(item => <button key={item.id} type="button" className={section === item.id ? "is-active" : ""} aria-current={section === item.id ? "page" : undefined}
            disabled={busy} onClick={() => { setSection(item.id); setSearch(""); }}><span className="admin-nav-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>)}
          <div className="admin-nav-note"><span className="admin-note-dot" />내가 고친 내용은<br />저장한 뒤 공개돼요.</div>
        </nav>
        <main className="admin-main">
          <div className="admin-section-head"><div><span className="admin-eyebrow">{content.profile.teacherName}</span><h2>{selected.label}</h2></div><span className="admin-section-detail">{selected.detail}</span></div>
          <fieldset disabled={saveStatus === "saving"} className="admin-fields">
          {section === "profile" ? <>
            <section className="admin-card"><h3>처음 만나는 내 미니홈피</h3><p className="admin-help">첫 화면과 왼쪽 프로필에 보이는 문구예요.</p>
              <div className="admin-two-columns"><Field label="표시 이름" required value={content.profile.teacherName} onChange={teacherName => setProfile({ teacherName })} /><Field label="첫 화면 제목" required value={content.profile.introTitle} onChange={introTitle => setProfile({ introTitle })} /></div>
              <Field label="소개 문구" multiline value={content.profile.introDescription} onChange={introDescription => setProfile({ introDescription })} />
              <Field label="프로필 아래 한 줄 설명" value={content.profile.catalogDescription} onChange={catalogDescription => setProfile({ catalogDescription })} />
              <Field label="오른쪽 위 주소 문구" value={content.profile.displayUrl} onChange={displayUrl => setProfile({ displayUrl })} />
            </section>
            <section className="admin-card"><h3>홈 화면 제목</h3><div className="admin-two-columns">
              <Field label="미니룸 제목" value={content.profile.miniroomTitle} onChange={miniroomTitle => setProfile({ miniroomTitle })} /><Field label="미니룸 한 줄 설명" value={content.profile.miniroomSub} onChange={miniroomSub => setProfile({ miniroomSub })} />
              <Field label="방명록 제목" value={content.profile.guestbookTitle} onChange={guestbookTitle => setProfile({ guestbookTitle })} /><Field label="방명록 한 줄 설명" value={content.profile.guestbookSub} onChange={guestbookSub => setProfile({ guestbookSub })} />
            </div></section>
            <section className="admin-card"><h3>게시판 안내</h3><Field label="게시판 한 줄 설명" value={content.profile.boardSubtitle} onChange={boardSubtitle => setProfile({ boardSubtitle })} /><Field label="글이 없을 때 안내" value={content.profile.boardEmptyText} onChange={boardEmptyText => setProfile({ boardEmptyText })} /></section>
          </> : null}
          {section === "tabs" ? <>
            <p className="admin-help">탭 이름을 바꾸거나 순서를 옮겨 보세요. 홈 탭은 항상 남겨 둡니다.</p>
            {content.tabs.map((item, index) => <section className="admin-card admin-tab-card" key={item.id}>
              <div className="admin-card-head"><span className="admin-badge">{{ home: "홈", profile: "소개", board: "게시판", photo: "사진", custom: "자유", oekaki: "낙서장", guestbook: "방명록" }[item.kind]}</span><OrderTools index={index} count={content.tabs.length} onMove={delta => update({ tabs: reorder(content.tabs, index, delta) })} onRemove={item.kind === "home" ? undefined : () => removeTab(item)} /></div>
              <Field label="탭 이름" required value={item.label} onChange={label => renameTab(item.id, { label })} />
              {["home", "oekaki"].includes(item.kind) ? null : <button type="button" className="admin-text-button" onClick={() => { setTabId(item.id); setSection("content"); }}>이 탭의 내용 편집 →</button>}
            </section>)}
            <button type="button" className="admin-add" onClick={() => { const item: TabDef = { id: newId("tab"), label: "새 탭", kind: "custom", view: "year" }; update({ tabs: [...content.tabs, item] }); }}>+ 새 탭 추가</button>
          </> : null}
          {section === "content" ? <>
            <div className="admin-content-controls"><label className="admin-select-field">편집할 탭<select value={tab?.id ?? ""} disabled={uploading} onChange={event => { setTabId(event.target.value); setSearch(""); }}>{editableTabs.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><span className="admin-count">{tab?.kind === "board" ? `${content.boardPosts.length}개의 글` : `${(content.blocks[tab?.id ?? ""] ?? []).length}개의 내용`}</span></div>
            {!tab ? <div className="admin-empty"><h3>내용을 담을 탭을 만들어 주세요.</h3><button type="button" onClick={() => setSection("tabs")}>탭 관리로 이동</button></div> : tab.kind === "board" ? <>
              <div className="admin-board-actions"><Field label="글 찾기" value={search} onChange={setSearch} hint="제목이나 설명으로 찾아보세요." /><button className="admin-primary" type="button" onClick={() => { setSearch(""); addPost(); }}>+ 글 추가</button></div>
              {content.boardPosts.filter(post => `${post.title} ${post.summary}`.toLowerCase().includes(search.toLowerCase())).map(post => { const index = content.boardPosts.findIndex(item => item.id === post.id); return <section className="admin-card" key={post.id}>
                <div className="admin-card-head"><h3>{post.title || "새 글"}</h3><OrderTools index={index} count={content.boardPosts.length} onMove={delta => update({ boardPosts: reorder(content.boardPosts, index, delta) })} onRemove={() => { if (window.confirm("이 글을 삭제할까요? 저장 전에는 되돌릴 수 있어요.")) update({ boardPosts: content.boardPosts.filter(item => item.id !== post.id) }); }} /></div>
                <Field label="글 제목" value={post.title} onChange={title => setPost(post.id, { title })} /><Field label="한 줄 설명" value={post.summary} onChange={summary => setPost(post.id, { summary })} /><Field label="링크 주소" type="url" value={post.href} onChange={href => setPost(post.id, { href })} hint="https://로 시작하는 주소를 넣어 주세요." />
                <div className="admin-two-columns"><Field label="분류" value={post.category} onChange={category => setPost(post.id, { category })} /><Field label="날짜" type="date" value={post.date} onChange={date => setPost(post.id, { date })} /></div>
              </section>; })}
              {!content.boardPosts.length ? <p className="admin-empty">첫 글을 추가해 보세요. 제목과 링크 주소부터 넣으면 돼요.</p> : null}
              {content.boardPosts.length > 0 && !content.boardPosts.some(post => `${post.title} ${post.summary}`.toLowerCase().includes(search.toLowerCase())) ? <p className="admin-empty">찾는 글이 없어요. 다른 검색어를 입력해 주세요.</p> : null}
            </> : <>
              <p className="admin-help">글·사진·링크를 추가하고 화살표로 순서를 바꾸세요. 사진은 여러 장을 한 번에 고를 수 있어요.</p>
              <BlockList key={tab.id} blocks={content.blocks[tab.id] ?? []} editing images={images} onBusyChange={setUploading} showYear={tab.kind !== "profile"}
                onChange={blocks => update({ blocks: { ...content.blocks, [tab.id]: blocks } })} />
            </>}
          </> : null}
          {section === "waves" ? <>
            <p className="admin-help">왼쪽 아래 파도타기에 보이는 링크예요. 도름스 활동 링크는 첫 자리에 둡니다.</p>
            {content.waveLinks.map((link, index) => <section className="admin-card" key={link.id}>
              <div className="admin-card-head"><span className="admin-badge">{index === 0 ? "첫 링크 · 고정" : "파도타기"}</span><OrderTools index={index - 1} count={content.waveLinks.length - 1} locked={index === 0} onMove={delta => update({ waveLinks: [content.waveLinks[0], ...reorder(content.waveLinks.slice(1), index - 1, delta)] })} onRemove={index === 0 ? undefined : () => { if (window.confirm("이 링크를 삭제할까요?")) update({ waveLinks: content.waveLinks.filter(item => item.id !== link.id) }); }} /></div>
              {index === 0 ? <strong className="admin-fixed-name">도름스 커뮤니티 나의 활동</strong> : <Field label="링크 이름" value={link.label} onChange={label => update({ waveLinks: content.waveLinks.map(item => item.id === link.id ? { ...item, label } : item) })} />}
              <Field label="링크 주소" type="url" value={link.href} onChange={href => update({ waveLinks: content.waveLinks.map(item => item.id === link.id ? { ...item, href } : item) })} />
            </section>)}
            <button type="button" className="admin-add" onClick={() => update({ waveLinks: [...content.waveLinks, { id: newId("wave"), label: "", href: "" }] })}>+ 링크 추가</button>
          </> : null}
          </fieldset>
        </main>
      </div>
      <footer className="admin-footer">
        <div className="admin-save-info" role="status" aria-live="polite"><span className={`admin-status-dot ${saveStatus}`} /><span>{uploading ? "사진을 올리고 있어요…" : saveStatus === "saving" ? "저장하고 있어요…" : saveStatus === "error" ? "저장하지 못했어요" : dirty ? "저장하지 않은 변경이 있어요" : saveStatus === "saved" ? "저장했어요. 방문자에게도 보여요." : "저장된 최신 내용을 편집 중이에요"}<small>{state.connected ? "저장하면 바로 반영돼요" : "인터넷 연결을 확인해 주세요"}</small></span></div>
        {state.saveError || state.conflict ? <p className="admin-error" role="alert">{state.saveError ?? "다른 창에서 내용이 바뀌었어요. 편집한 내용을 복사한 뒤 변경 취소를 눌러 최신 내용을 확인해 주세요."}</p> : null}
        <div className="admin-footer-actions"><div className="admin-history"><button type="button" disabled={busy || !state.canUndo} onClick={state.undo} title="되돌리기" aria-label="되돌리기">↶ <span>되돌리기</span></button><button type="button" disabled={busy || !state.canRedo} onClick={state.redo} title="다시 적용" aria-label="다시 적용">↷ <span>다시 적용</span></button></div><button className="admin-quiet" type="button" disabled={busy} onClick={discard}>{dirty ? "변경 취소" : "닫기"}</button><button type="button" className="admin-primary" disabled={busy || !dirty || !state.connected || state.conflict} onClick={() => void save()}>{saveStatus === "saving" ? "저장 중…" : "변경사항 저장"}</button></div>
      </footer>
    </div>
  </div>;
}
