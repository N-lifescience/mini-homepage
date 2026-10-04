"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, MotionConfig, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useSiteContent } from "@/lib/site-content";
import { asset } from "@/lib/asset";
import { showroomCopy } from "@/config/showroom/content";
import { showroomTheme } from "@/config/showroom/theme";
import DnaStage from "./DnaStage";
import CardDetail from "./CardDetail";
import ShowcaseCard from "./ShowcaseCard";
import { exhibitionGroups, newTabProps, type OpenCard } from "./utils";

export default function Showroom() {
  const { content, ready, loadError, retry } = useSiteContent();
  const journeyRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<OpenCard | null>(null);
  const [phase, setPhase] = useState(0);
  const [filter, setFilter] = useState("all");
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: journeyRef, offset: ["start start", "end end"] });
  const indicator = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  useMotionValueEvent(scrollYProgress, "change", p => setPhase(p < 0.30 ? 0 : p < 0.66 ? 1 : 2));
  const groups = ready ? exhibitionGroups(content.boardPosts) : [];
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  const shown = filter === "all" ? groups : groups.filter(group => group.id === filter);
  const copy = showroomCopy.phases[phase];
  const closeDetail = useCallback(() => {
    const trigger = open?.trigger;
    setOpen(null);
    // Wait until React removes inert before handing keyboard focus back.
    requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
  }, [open]);

  useEffect(() => {
    if (filter !== "all" && !groups.some(group => group.id === filter)) setFilter("all");
  }, [filter, groups]);

  return <MotionConfig reducedMotion="user"><LayoutGroup>
    <div className="sr-root" style={Object.fromEntries(Object.entries(showroomTheme.colors).map(([key, value]) => [`--sr-${key}`, value]))}>
      <div className="sr-content" inert={open !== null}>
        <a className="sr-skip" href="#exhibition">전시 둘러보기</a>
        <header className="sr-nav">
          <a className="sr-brand" href={asset("/")} aria-label="첫 화면"><span className="sr-brand-mark">N</span><span>생명과학<span className="sr-brand-caption">SHOWROOM</span></span></a>
          <nav aria-label="화면 이동">
            <a href={asset("/")}>첫 화면</a>
            <a href={asset("/?tab=home")}>미니홈피 <span aria-hidden="true">↗</span></a>
          </nav>
        </header>

        <section ref={journeyRef} className="sr-journey" aria-label="DNA 쇼룸">
          <div className="sr-journey-sticky">
            <DnaStage progress={scrollYProgress} />
            <div className="sr-hero-copy">
              <span className="sr-eyebrow">N’S LIFE SCIENCE</span>
              <motion.div key={reduced ? "static" : phase} initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h1>{reduced ? showroomCopy.title : copy.title}</h1>
                <p>{phase === 0 ? content.profile.introDescription : copy.description}</p>
              </motion.div>
              <a className="sr-explore" href="#exhibition">전시 둘러보기 <span aria-hidden="true">↓</span></a>
              <ul className="sr-molecule-key" aria-label="전사에 참여하는 분자">
                <li><span className="sr-key-factor" />전사인자</li>
                <li><span className="sr-key-polymerase" />RNA 합성효소</li>
                <li><span className="sr-key-ntp" />NTPs</li>
              </ul>
            </div>
            <div className="sr-specimen-label" aria-hidden="true"><span>{copy.label}</span><span>DNA / N LAB</span></div>
            <div className="sr-journey-foot">
              <span className="sr-scroll-cue">{showroomCopy.scroll} <span aria-hidden="true">↓</span></span>
              <div className="sr-phase-markers" aria-label="전시 연출 진행">
                {showroomCopy.phases.map((item, index) => <span key={item.label} className={index === phase ? "is-active" : ""} aria-current={index === phase ? "step" : undefined}><span className="sr-phase-dot" />{item.label}</span>)}
              </div>
            </div>
            <div className="sr-progress" aria-hidden="true"><motion.span style={{ width: indicator }} /></div>
          </div>
        </section>

        <main id="exhibition" className="sr-catalog">
          <div className="sr-catalog-heading">
            <div><span className="sr-eyebrow">THE COLLECTION</span><h2>{showroomCopy.catalogTitle}</h2><p>{showroomCopy.catalogDescription}</p></div>
            <span className="sr-collection-count" aria-label={ready ? `전시 ${count}개` : undefined}>{ready ? String(count).padStart(2, "0") : "··"}<span>WORKS</span></span>
          </div>
          {groups.length > 0 && <div className="sr-filters" role="group" aria-label="전시 분류">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>전체 <span>{count}</span></button>
            {groups.map(group => <button type="button" key={group.id} aria-pressed={filter === group.id} onClick={() => setFilter(group.id)}>{group.title}<span>{group.items.length}</span></button>)}
          </div>}
          <div className="sr-exhibitions" aria-live="polite" aria-busy={!ready}>
            {!ready && <div className="sr-empty" role="status"><p>{loadError ?? "최신 내용을 불러오고 있어요"}</p>{loadError && <button type="button" className="sr-btn sr-btn-primary" onClick={retry}>다시 불러오기</button>}</div>}
            {shown.map(group => <section key={group.id} className="sr-group" aria-labelledby={`sr-${group.id}`}>
              <div className="sr-group-head"><h3 id={`sr-${group.id}`}>{group.title}</h3><p>{group.description}</p></div>
              <div className="sr-grid">
                {group.items.map((item, index) => <motion.div key={item.id} className="sr-cell" initial={reduced ? false : { opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.18) }}>
                  <ShowcaseCard item={item} layoutId={`exhibit-${item.id}`} onOpen={setOpen} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px" />
                </motion.div>)}
              </div>
            </section>)}
            {ready && !count && <div className="sr-empty"><h3>전시된 자료가 없습니다.</h3><p>미니홈피에서 다른 활동을 구경해 보세요.</p><a className="sr-btn sr-btn-primary" href={asset("/?tab=home")}>미니홈피</a></div>}
          </div>
        </main>
        <footer className="sr-foot">
          <div className="sr-foot-top"><a className="sr-foot-home" href={asset("/?tab=home")}>미니홈피 <span aria-hidden="true">↗</span></a><div className="sr-foot-links">{content.waveLinks.filter(link => ["dorms-activity", "instagram", "naver-blog"].includes(link.id)).map(link => <a key={link.id} href={link.href} {...newTabProps(link.href)}>{link.label}</a>)}</div></div>
          <p>DNA와 전사 과정을 모티브로 만든 연출입니다.</p>
          <p className="sr-credits"><a href="https://www.meshy.ai/" {...newTabProps("https://www.meshy.ai/")}>3D 현미경: Meshy (CC BY 4.0)</a><a href="https://github.com/dossamlab/showroom-kit" {...newTabProps("https://github.com/dossamlab/showroom-kit")}>쇼룸 코드: dossamlab/showroom-kit (MIT)</a></p>
          <span className="sr-foot-signature">N’S LIFE SCIENCE</span>
        </footer>
      </div>
      <CardDetail open={open} onClose={closeDetail} />
    </div>
  </LayoutGroup></MotionConfig>;
}
