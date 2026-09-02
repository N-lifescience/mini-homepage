"use client";

/* 주인장이 화면에서 바로 고칠 수 있게 해 주는 부품들입니다.
   편집 모드가 꺼져 있으면 평범한 글자·그림으로만 보입니다. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  newId,
  resolveImageSrc,
  uploadImage,
  type ContentBlock,
  type TabView
} from "@/lib/site-content";

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
  editing
}: {
  view: TabView;
  onChange: (next: TabView) => void;
  editing: boolean;
}) {
  const items: { id: TabView; label: string }[] = [
    { id: "list", label: "목록" },
    { id: "album", label: "앨범" },
    { id: "year", label: "연도별" }
  ];
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
  const [busy, setBusy] = useState(false);

  const replace = (id: string, patch: Partial<ContentBlock>) =>
    onChange(blocks.map(b => (b.id === id ? ({ ...b, ...patch } as ContentBlock) : b)));

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
            : { ...base, type: "image", imageId: "", caption: "" };
    onChange([...blocks, created]);
  };

  const pickImage = async (blockId: string, file: File) => {
    setBusy(true);
    try {
      const imageId = await uploadImage(file);
      replace(blockId, { imageId } as Partial<ContentBlock>);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "사진을 올리지 못했어요.");
    } finally {
      setBusy(false);
    }
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

      const src = resolveImageSrc(block.imageId, images);
      return (
        <figure className="cy-block-figure">
          {src ? (
            <img src={src} alt={block.caption} loading="lazy" />
          ) : (
            <div className="cy-block-image-empty">사진을 골라 주세요</div>
          )}
          {editing ? (
            <label className="cy-image-pick">
              {busy ? "올리는 중…" : src ? "사진 바꾸기" : "사진 고르기"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) pickImage(block.id, file);
                  e.target.value = "";
                }}
              />
            </label>
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
    </>
  );
}
