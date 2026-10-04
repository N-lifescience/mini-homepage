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

/* Editing uses real, labelled fields. Changes stay in the draft until Save. */
export function EditableText({
  value, onSave, editing, multiline = false, placeholder = "내용을 적어 주세요",
  className, as: Tag = "span", label
}: {
  value: string;
  onSave: (next: string) => void;
  editing: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  as?: "span" | "div" | "p" | "figcaption";
  label?: string;
}) {
  if (!editing) return <Tag className={className}>{value}</Tag>;
  const shared = {
    value, placeholder, "aria-label": label ?? placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onSave(event.target.value),
    className: "cy-edit-input"
  };
  return <label className="cy-edit-field">
    <span>{label ?? placeholder}</span>
    {multiline ? <textarea {...shared} rows={Math.min(10, Math.max(3, value.split("\n").length))} /> : <input {...shared} />}
  </label>;
}

const UNSORTED_YEAR = "기타";

/* 글·사진·링크 블록 목록입니다. 새 탭, 프로필 탭, 사진첩이 모두 이걸 씁니다. */
export function BlockList({
  blocks,
  onChange,
  editing,
  images,
  view = "list",
  onBusyChange,
  showYear = true
}: {
  blocks: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
  editing: boolean;
  images: Record<string, string>;
  view?: TabView;
  onBusyChange?: (busy: boolean) => void;
  showYear?: boolean;
}) {
  /* 사진을 여러 장 한꺼번에 올릴 때 어느 블록에 몇 장째인지 보여 주려고 들고 있습니다. */
  const [uploading, setUploading] = useState<{ blockId: string; done: number; total: number } | null>(null);
  /* 크게 넘겨 보는 화면을 띄운 사진 블록입니다. */
  const [viewerBlockId, setViewerBlockId] = useState<string | null>(null);

  /* 사진 올리기는 시간이 걸려서, 올리는 동안 주인장이 다른 곳을 고쳤을 수 있습니다.
     항상 가장 최근 목록 위에 고쳐 쓰도록 여기에 담아 둡니다. */
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const addedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!addedIdRef.current) return;
    const element = document.getElementById(`editor-block-${addedIdRef.current}`);
    element?.scrollIntoView({ block: "nearest", behavior: "instant" });
    element?.querySelector<HTMLInputElement | HTMLTextAreaElement>("textarea, input:not([inputmode=numeric])")?.focus();
    addedIdRef.current = null;
  }, [blocks]);

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
    addedIdRef.current = created.id;
    onChange([...blocks, created]);
  };

  /* 고른 사진을 차례로 올려서 이 블록 뒤에 붙입니다. 여러 장을 한 번에 골라도 됩니다.
     한 장이라도 올라갔으면 도중에 실패해도 올라간 만큼은 남깁니다. */
  const pickImages = async (block: ContentBlock, files: File[]) => {
    if (files.length === 0 || uploading) return;
    onBusyChange?.(true);
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
      onBusyChange?.(false);
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
      if (!editing && (block.type === "text" || block.type === "heading") && /^-{4,}$/.test(block.text.trim())) {
        return <hr className="cy-block-divider" />;
      }
      if (block.type === "heading") {
        return (
          <EditableText
            as="div"
            className="cy-profile-list-heading"
            value={block.text}
            editing={editing}
            placeholder="소제목"
            label="소제목"
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
            label="본문"
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
                label="링크 주소"
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
              <label className="cy-image-pick" role="button" tabIndex={uploading ? -1 : 0} aria-disabled={Boolean(uploading)}
                onKeyDown={event => {
                  if (!uploading && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    event.currentTarget.querySelector("input")?.click();
                  }
                }}>
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
                  disabled={Boolean(uploading)}
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
      <div key={block.id} id={`editor-block-${block.id}`} className={`cy-block is-${block.type} is-editing`}>
        <div className="cy-block-editor-head">
          <span className="cy-block-kind">{{ heading: "소제목", text: "글", link: "링크", image: "사진" }[block.type]}</span>
          <div className="cy-block-tools">
            <button type="button" disabled={Boolean(uploading) || blocks[0]?.id === block.id} aria-label="내용 위로 이동" onClick={() => move(block.id, -1)}>↑</button>
            <button type="button" disabled={Boolean(uploading) || blocks.at(-1)?.id === block.id} aria-label="내용 아래로 이동" onClick={() => move(block.id, 1)}>↓</button>
            <button type="button" disabled={Boolean(uploading)} onClick={() => onChange([...blocksRef.current, { ...block, id: newId("b") }])}>복제</button>
            <button type="button" disabled={Boolean(uploading)} className="is-danger" onClick={() => remove(block.id)}>삭제</button>
          </div>
        </div>
        {showYear ? <label className="cy-edit-field cy-block-year">
          <span>연도 <small>선택</small></span>
          <input type="text" inputMode="numeric" placeholder="예: 2026" maxLength={4} value={block.year ?? ""}
            onChange={event => replace(block.id, { year: event.target.value })} />
        </label> : null}
        {inner}
      </div>
    );
  };

  const layoutClass = editing || view === "list" ? "cy-block-article" : "cy-block-grid";

  /* 크게 보기 화면에 넘겨 줄 사진들입니다. 아직 안 불러온 사진은 빼고 보여 줍니다. */
  const found = blocks.find(b => b.id === viewerBlockId);
  const viewerBlock = found && found.type === "image" ? found : null;
  const viewerSrcs = viewerBlock
    ? blockImageIds(viewerBlock).map(id => resolveImageSrc(id, images)).filter(Boolean)
    : [];

  return (
    <>
      {editing ? (
        <div className="cy-block-add">
          <span className="cy-block-add-label">추가</span>
          <button type="button" disabled={Boolean(uploading)} onClick={() => add("heading")}>+ 소제목</button>
          <button type="button" disabled={Boolean(uploading)} onClick={() => add("text")}>+ 글</button>
          <button type="button" disabled={Boolean(uploading)} onClick={() => add("image")}>+ 사진</button>
          <button type="button" disabled={Boolean(uploading)} onClick={() => add("link")}>+ 링크</button>
        </div>
      ) : null}

      {groups && !editing ? (
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
