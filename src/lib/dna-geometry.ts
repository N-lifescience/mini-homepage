export const smoothProgress = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

export const transcriptionSite = (progress: number) => .17 + smoothProgress(.10, .95, progress) * .62;

// Unzip up to the moving polymerase and keep the traversed section open.
export function strandOpening(s: number, progress: number) {
  const start = transcriptionSite(0);
  const site = transcriptionSite(progress);
  const distance = (s < start ? s - start : s > site ? s - site : 0) / .13;
  return Math.exp(-Math.pow(distance, 4)) * (.24 + smoothProgress(.04, .24, progress) * .76);
}

export function dnaPoint(s: number, strand: number, progress: number, twist = 0): [number, number, number] {
  const opening = strandOpening(s, progress);
  const angle = s * Math.PI * 5.5 + twist + strand * Math.PI;
  const radius = 1.06 * (1 - opening * .86);
  return [
    Math.cos(angle) * radius + (strand ? 1 : -1) * opening * .72 + Math.sin(s * Math.PI * 1.4) * .28,
    (s - .5) * 8.6,
    Math.sin(angle) * radius
  ];
}

// Keep the template strand in the protein's central cleft at every scroll position.
export function polymerasePosition(progress: number, twist = 0): [number, number, number] {
  const point = dnaPoint(transcriptionSite(progress), 0, progress, twist);
  return [point[0] + .25, point[1], point[2] + .45];
}

export function rnaPoint(s: number, progress: number, twist = 0, time = 0): [number, number, number] {
  const root = polymerasePosition(progress, twist);
  const growth = smoothProgress(.12, .92, progress);
  const length = (1 + (transcriptionSite(progress) - .17) * 8.6) * growth;
  return [
    root[0] - .18 - Math.sin(s * Math.PI * .5) * 2.6 * growth + Math.sin(s * Math.PI * 5 + time) * .18 * s,
    root[1] - .32 - s * length,
    root[2] + .63 + Math.sin(s * Math.PI * 4 + time) * .20 * s
  ];
}
