"use client";

/* 사진 여러 장이 들어 있는 글을 눌렀을 때 크게 넘겨 보는 화면입니다.
   목록에서는 대표 사진 한 장만 보이고, 누르면 이 화면이 덮으면서 전부 보입니다. */

import { useCallback, useEffect, useState } from "react";

export default function PhotoViewer({
  srcs,
  caption,
  startIndex = 0,
  onClose
}: {
  srcs: string[];
  caption?: string;
  startIndex?: number;
  onClose: () => void;
}) {
  const total = srcs.length;
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(total - 1, 0)));

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return;
      setIndex(prev => (prev + delta + total) % total);
    },
    [total]
  );

  /* 키보드로도 넘기고 닫을 수 있게 합니다. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  /* 열려 있는 동안 뒤쪽 화면이 같이 굴러가지 않게 잠급니다. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (total === 0) return null;

  return (
    <div className="cy-viewer" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cy-viewer-box" onClick={e => e.stopPropagation()}>
        <div className="cy-viewer-head">
          <span className="cy-viewer-caption">{caption || "사진"}</span>
          <span className="cy-viewer-count">
            {index + 1} / {total}
          </span>
          <button type="button" className="cy-viewer-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="cy-viewer-stage">
          {total > 1 ? (
            <button type="button" className="cy-viewer-nav is-prev" onClick={() => go(-1)} aria-label="이전 사진">
              ‹
            </button>
          ) : null}
          <img src={srcs[index]} alt={caption ? `${caption} ${index + 1}` : `사진 ${index + 1}`} />
          {total > 1 ? (
            <button type="button" className="cy-viewer-nav is-next" onClick={() => go(1)} aria-label="다음 사진">
              ›
            </button>
          ) : null}
        </div>

        {total > 1 ? (
          <div className="cy-viewer-strip">
            {srcs.map((src, i) => (
              <button
                key={`${src.slice(0, 24)}-${i}`}
                type="button"
                className={`cy-viewer-thumb${i === index ? " is-on" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}번째 사진`}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
