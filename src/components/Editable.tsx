"use client";

/* 주인장이 화면에서 바로 고칠 수 있게 해 주는 부품들입니다.
   편집 모드가 꺼져 있으면 평범한 글자·그림으로만 보입니다. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  blockImageIds,
  imageIdsPatch,
  newId,
  resolveImageSrc,
  uploadImage,
  type ContentBlock,
  type TabView
} from "@/lib/site-content";
import PhotoViewer from "@/components/PhotoViewer";

/* 글자 한 줄을 눌러서 고칩니다. 여러 줄이면 multiline 을 켭니다. */
export function EditableText({
  value,
  onSave,
  editing,
  multiline = false,
  placeholder = "내용을 적어 주세요",
  className,
  as: Tag = "span"
}: {
  value: string;
  onSave: (next: string) => void;
  editing: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  as?: "span" | "div" | "p" | "figcaption";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  const commit = () => {
    setOpen(false);
    const next = draft.trim();
    if (next !== value) onSave(next);
  };

  if (!editing) {
    return <Tag className={className}>{value || placeholder}</Tag>;
  }

  if (!open) {
    return (
      <Tag
        className={`${className ?? ""} cy-editable`.trim()}
        onClick={() => setOpen(true)}
        title="눌러서 고치기"
      >
        {value || <span className="cy-editable-empty">{placeholder}</span>}
      </Tag>
    );
  }

  const shared = {
    ref: ref as never,
    value: draft,
    placeholder,
    onBlur: commit,
    className: "cy-edit-input"
  };

  return multiline ? (
    <textarea
      {...shared}
      rows={Math.max(2, draft.split("\n").length)}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Escape") {
          setDraft(value);
          setOpen(false);
        }
      }}
    />
  ) : (
    <input
      {...shared}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setOpen(false);
        }
      }}
    />
  );
}

/* 목록 / 앨범 / 연도별 보기를 고르는 작은 탭입니다. 싸이월드 사진첩의 보기 전환처럼요. */
export function ViewSwitch({
  view,
  onChange,
  editing,
  options
}: {
  view: TabView;
  onChange: (next: TabView) => void;
  editing: boolean;
  /* 이 탭에서 고를 수 있는 보기입니다. 사진 위주 탭은 목록 보기를 빼고
     앨범/연도별만 씁니다. */
  options?: TabView[];
}) {
  const labels: Record<TabView, string> = {
    list: "목록보기",
    album: "앨범보기",
    year: "연도별보기"
  };
  const allowed = options ?? (["list", "album", "year"] as TabView[]);
  const items = allowed.map(id => ({ id, label: labels[id] }));
  return (
    <div className="cy-view-switch" title={editing ? "여기서 고른 보기가 기본으로 저장됩니다" : undefined}>
      {items.map((item, i) => (
        <span key={item.id}>
          {i > 0 ? <span className="cy-view-sep">|</span> : null}
          <button
            type="button"
            className={`cy-view-btn${view === item.id ? " is-on" : ""}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        </span>
      ))}
      {editing ? <span className="cy-view-note">(기본 보기로 저장됨)</span> : null}
    </div>
  );
}

const UNSORTED_YEAR = "기타";

/* 글·사진·링크 블록 목록입니다. 새 탭, 프로필 탭, 사진첩이 모두 이걸 씁니다. */
export function BlockList({
  blocks,
  onChange,
  editing,
  images,
  view = "list"
}: {
  blocks: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
  editing: boolean;
  images: Record<string, string>;
  view?: TabView;
}) {
  /* 사진을 여러 장 한꺼번에 올릴 때 어느 블록에 몇 장째인지 보여 주려고 들고 있습니다. */
  const [uploading, setUploading] = useState<{ blockId: string; done: number; total: number } | null>(null);
  /* 크게 넘겨 보는 화면을 띄운 사진 블록입니다. */
  const [viewerBlockId, setViewerBlockId] = useState<string | null>(null);

  /* 사진 올리기는 시간이 걸려서, 올리는 동안 주인장이 다른 곳을 고쳤을 수 있습니다.
     항상 가장 최근 목록 위에 고쳐 쓰도록 여기에 담아 둡니다. */
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const replace = (id: string, patch: Partial<ContentBlock>) =>
    onChange(blocksRef.current.map(b => (b.id === id ? ({ ...b, ...patch } as ContentBlock) : b)));

  const remove = (id: string) => {
    if (!window.confirm("이 내용을 지울까요?")) return;
    onChange(blocks.filter(b => b.id !== id));
  };

  const move = (id: string, delta: number) => {
    const index = blocks.findIndex(b => b.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= blocks.length) return;
    const copy = [...blocks];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange(copy);
  };

  const add = (type: ContentBlock["type"]) => {
    const base = { id: newId("b") };
    const created: ContentBlock =
      type === "heading"
        ? { ...base, type: "heading", text: "소제목" }
        : type === "text"
          ? { ...base, type: "text", text: "" }
          : type === "link"
            ? { ...base, type: "link", label: "", href: "" }
            : { ...base, type: "image", imageId: "", imageIds: [], caption: "" };
    onChange([...blocks, created]);
  };

  /* 고른 사진을 차례로 올려서 이 블록 뒤에 붙입니다. 여러 장을 한 번에 골라도 됩니다.
     한 장이라도 올라갔으면 도중에 실패해도 올라간 만큼은 남깁니다. */
  const pickImages = async (block: ContentBlock, files: File[]) => {
    if (files.length === 0) return;
    setUploading({ blockId: block.id, done: 0, total: files.length });
    const added: string[] = [];
    try {
      for (const file of files) {
        added.push(await uploadImage(file));
        setUploading({ blockId: block.id, done: added.length, total: files.length });
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "사진을 올리지 못했어요.");
    } finally {
      if (added.length > 0) {
        const latest = blocksRef.current.find(b => b.id === block.id) ?? block;
        replace(block.id, imageIdsPatch([...blockImageIds(latest), ...added]) as Partial<ContentBlock>);
      }
      setUploading(null);
    }
  };

  /* 블록 안에서 사진 순서를 바꿉니다. 맨 앞으로 오면 그게 대표 사진이 됩니다. */
  const movePhoto = (block: ContentBlock, index: number, delta: number) => {
    const ids = blockImageIds(block);
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    const copy = [...ids];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    replace(block.id, imageIdsPatch(copy) as Partial<ContentBlock>);
  };

  /* 사진 한 장만 블록에서 뺍니다. 블록 자체는 그대로 둡니다. */
  const removePhoto = (block: ContentBlock, index: number) => {
    const ids = blockImageIds(block);
    if (!window.confirm("이 사진을 뺄까요?")) return;
    replace(block.id, imageIdsPatch(ids.filter((_, i) => i !== index)) as Partial<ContentBlock>);
  };

  /* 연도별 보기: 연도가 큰 순서로 묶고, 연도가 없는 건 맨 뒤 "기타" 로 보냅니다. */
  const groups = useMemo(() => {
    if (view !== "year") return null;
    const map = new Map<string, ContentBlock[]>();
    blocks.forEach(b => {
      const key = (b.year ?? "").trim() || UNSORTED_YEAR;
      map.set(key, [...(map.get(key) ?? []), b]);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNSORTED_YEAR) return 1;
      if (b === UNSORTED_YEAR) return -1;
      return b.localeCompare(a);
    });
  }, [blocks, view]);

  const renderBlock = (block: ContentBlock) => {
    const inner = (() => {
      if (block.type === "heading") {
        return (
          <EditableText
            as="div"
            className="cy-profile-list-heading"
            value={block.text}
            editing={editing}
            placeholder="소제목"
            onSave={text => replace(block.id, { text } as Partial<ContentBlock>)}
          />
        );
      }
      if (block.type === "text") {
        return (
          <EditableText
            as="p"
            className="cy-block-text"
            value={block.text}
            editing={editing}
            multiline
            placeholder="내용을 적어 주세요"
            onSave={text => replace(block.id, { text } as Partial<ContentBlock>)}
          />
        );
      }
      if (block.type === "link") {
        if (editing) {
          return (
            <div className="cy-block-link-edit">
              <EditableText
                value={block.label}
                editing
                placeholder="링크 이름"
                onSave={label => replace(block.id, { label } as Partial<ContentBlock>)}
              />
              <EditableText
                className="cy-block-href"
                value={block.href}
                editing
                placeholder="https://..."
                onSave={href => replace(block.id, { href } as Partial<ContentBlock>)}
              />
            </div>
          );
        }
        return (
          <a className="cy-block-link" href={block.href} target="_blank" rel="noopener noreferrer">
            {block.label || block.href}
          </a>
        );
      }

      /* 사진 블록입니다. 목록에는 대표 사진(첫 장) 한 장만 내보이고,
         누르면 이 글에 들어 있는 사진을 전부 넘겨 볼 수 있습니다. */
      const ids = blockImageIds(block);
      const cover = ids.length > 0 ? resolveImageSrc(ids[0], images) : "";
      return (
        <figure className="cy-block-figure">
          {cover ? (
            <button
              type="button"
              className="cy-photo-cover"
              onClick={() => setViewerBlockId(block.id)}
              title={ids.length > 1 ? `사진 ${ids.length}장 보기` : "크게 보기"}
            >
              <img src={cover} alt={block.caption} loading="lazy" />
              {ids.length > 1 ? <span className="cy-photo-count">+{ids.length - 1}</span> : null}
            </button>
          ) : (
            <div className="cy-block-image-empty">사진을 골라 주세요</div>
          )}
          {editing ? (
            <>
              {ids.length > 0 ? (
                <div className="cy-photo-strip">
                  {ids.map((id, i) => (
                    <div key={`${id}-${i}`} className={`cy-photo-thumb${i === 0 ? " is-cover" : ""}`}>
                      <img src={resolveImageSrc(id, images)} alt="" />
                      {i === 0 ? <span className="cy-photo-tag">대표</span> : null}
                      <div className="cy-photo-thumb-tools">
                        {ids.length > 1 ? (
                          <>
                            <button type="button" onClick={() => movePhoto(block, i, -1)} title="앞으로">
                              ‹
                            </button>
                            <button type="button" onClick={() => movePhoto(block, i, 1)} title="뒤로">
                              ›
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => removePhoto(block, i)}
                          title="이 사진 빼기"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <label className="cy-image-pick">
                {uploading && uploading.blockId === block.id
                  ? `올리는 중 ${uploading.done}/${uploading.total}…`
                  : ids.length > 0
                    ? "사진 더 넣기"
                    : "사진 고르기"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length > 0) pickImages(block, files);
                  }}
                />
              </label>
              {ids.length > 1 ? (
                <span className="cy-photo-hint">맨 앞 사진이 목록에 보이는 대표 사진입니다</span>
              ) : null}
            </>
          ) : null}
          {block.caption || editing ? (
            <EditableText
              as="figcaption"
              value={block.caption}
              editing={editing}
              placeholder="사진 설명"
              onSave={caption => replace(block.id, { caption } as Partial<ContentBlock>)}
            />
          ) : null}
        </figure>
      );
    })();

    if (!editing) {
      return (
        <div key={block.id} className={`cy-block is-${block.type}`}>
          {inner}
        </div>
      );
    }

    return (
      <div key={block.id} className={`cy-block is-${block.type} is-editing`}>
        <div className="cy-block-tools">
          <label className="cy-year-chip" title="연도별 보기에서 묶는 기준">
            <input
              type="text"
              inputMode="numeric"
              placeholder="연도"
              maxLength={4}
              defaultValue={block.year ?? ""}
              onBlur={e => {
                const year = e.target.value.trim();
                if (year !== (block.year ?? "")) replace(block.id, { year } as Partial<ContentBlock>);
              }}
            />
          </label>
          <button type="button" onClick={() => move(block.id, -1)}>[↑]</button>
          <button type="button" onClick={() => move(block.id, 1)}>[↓]</button>
          <button type="button" className="is-danger" onClick={() => remove(block.id)}>[삭제]</button>
        </div>
        {inner}
      </div>
    );
  };

  const layoutClass = view === "list" ? "cy-block-article" : "cy-block-grid";

  /* 크게 보기 화면에 넘겨 줄 사진들입니다. 아직 안 불러온 사진은 빼고 보여 줍니다. */
  const found = blocks.find(b => b.id === viewerBlockId);
  const viewerBlock = found && found.type === "image" ? found : null;
  const viewerSrcs = viewerBlock
    ? blockImageIds(viewerBlock).map(id => resolveImageSrc(id, images)).filter(Boolean)
    : [];

  return (
    <>
      {groups ? (
        groups.map(([year, list]) => (
          <section key={year} className="cy-year-group">
            <div className="cy-year-head">
              <span className="cy-year-label">{year}</span>
              <span className="cy-year-count">{list.length}</span>
            </div>
            <div className="cy-block-grid">{list.map(renderBlock)}</div>
          </section>
        ))
      ) : (
        <div className={layoutClass}>{blocks.map(renderBlock)}</div>
      )}

      {blocks.length === 0 && !editing ? (
        <div className="cy-empty-box">아직 내용이 없습니다.</div>
      ) : null}

      {editing ? (
        <div className="cy-block-add">
          <span className="cy-block-add-label">추가</span>
          <button type="button" onClick={() => add("heading")}>소제목</button>
          <button type="button" onClick={() => add("text")}>글</button>
          <button type="button" onClick={() => add("image")}>사진</button>
          <button type="button" onClick={() => add("link")}>링크</button>
        </div>
      ) : null}

      {viewerBlock && viewerSrcs.length > 0 ? (
        <PhotoViewer
          srcs={viewerSrcs}
          caption={viewerBlock.caption}
          onClose={() => setViewerBlockId(null)}
        />
      ) : null}
    </>
  );
}
