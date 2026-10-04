"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import CardArt from "./CardArt";
import { newTabProps, type OpenCard } from "./utils";

export default function CardDetail({ open, onClose }: { open: OpenCard | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("a[href], button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => goRef.current?.focus({ preventScroll: true }), 60);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div key="detail" className="sr-detail-layer">
          <motion.button
            type="button"
            className="sr-detail-backdrop"
            aria-label="닫기"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={dialogRef}
            layoutId={open.layoutId}
            className="sr-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-detail-title"
            style={{ borderRadius: 22 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <div className="sr-detail-art">
              <CardArt item={open.item} sizes="(max-width: 767px) 100vw, 420px" />
            </div>
            <motion.div
              className="sr-detail-body"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.18 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              <span className="sr-detail-group">{open.item.groupName}</span>
              <span className="sr-tag">{open.item.tag}</span>
              <h2 id="sr-detail-title" className="sr-detail-name">
                {open.item.name}
              </h2>
              {open.item.description ? <p className="sr-detail-desc">{open.item.description}</p> : null}
              <a ref={goRef} className="sr-btn sr-btn-primary sr-detail-go" href={open.item.href} {...newTabProps(open.item.href)}>
                바로가기 <span aria-hidden="true">↗</span>
              </a>
            </motion.div>
            <button type="button" className="sr-detail-close" aria-label="닫기" onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
