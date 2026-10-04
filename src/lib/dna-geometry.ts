export const smoothProgress = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

export const transcriptionTimeline = (progress: number) => ({
  factorBinding: smoothProgress(.02, .16, progress),
  polymeraseBinding: smoothProgress(.20, .34, progress),
  elongation: smoothProgress(.38, .98, progress)
});

export const transcriptionSite = (progress: number) => .17 + transcriptionTimeline(progress).elongation * .62;

// Unzip up to the moving polymerase and keep the traversed section open.
export function strandOpening(s: number, progress: number) {
  const start = transcriptionSite(0);
  const site = transcriptionSite(progress);
  const distance = (s < start ? s - start : s > site ? s - site : 0) / .13;
  return Math.exp(-Math.pow(distance, 4)) * smoothProgress(.38, .44, progress);
}

export function dnaPoint(s: number, strand: number, progress: number, twist = 0): [number, number, number] {
  const opening = strandOpening(s, progress);
  const angle = s * Math.PI * 5.5 + twist + strand * Math.PI;
  const radius = 1.06 * (1 - opening * .86);
  return [
    Math.cos(angle) * radius + (strand ? 1 : -1) * opening * 1.6 + Math.sin(s * Math.PI * 1.4) * .28,
    (s - .5) * 8.6,
    Math.sin(angle) * radius
  ];
}

type Point = [number, number, number];

// Each base stays attached to its backbone at full length; only its orientation changes.
export function dnaBaseEndpoints(s: number, strand: number, progress: number, twist = 0): [Point, Point] {
  const anchor = dnaPoint(s, strand, progress, twist);
  const closedAngle = s * Math.PI * 5.5 + twist + strand * Math.PI + Math.PI;
  const openAngle = strand ? Math.PI : 0;
  const rotation = Math.atan2(Math.sin(openAngle - closedAngle), Math.cos(openAngle - closedAngle));
  const angle = closedAngle + rotation * strandOpening(s, progress);
  const length = 1.06;
  return [anchor, [anchor[0] + Math.cos(angle) * length, anchor[1], anchor[2] + Math.sin(angle) * length]];
}

function boundPolymerasePosition(progress: number, twist: number): Point {
  const point = dnaPoint(transcriptionSite(progress), 0, progress, twist);
  return [point[0] + .25, point[1], point[2] + .45];
}

function blend(from: Point, to: Point, amount: number): Point {
  if (amount === 0) return from;
  if (amount === 1) return to;
  return from.map((value, axis) => value + (to[axis] - value) * amount) as Point;
}

// Recruit the enzyme after the factors bind, then carry it along the template strand.
export function polymerasePosition(progress: number, twist = 0): Point {
  const initial = boundPolymerasePosition(0, twist);
  const free: Point = [initial[0] + 3, initial[1] - .55, initial[2] + .85];
  return blend(free, boundPolymerasePosition(progress, twist), transcriptionTimeline(progress).polymeraseBinding);
}

export function factorPosition(index: number, progress: number, twist = 0): Point {
  const contact = dnaPoint(transcriptionSite(0) + (index ? .03 : -.03), 0, progress, twist);
  contact[0] += index ? .2 : -.18;
  contact[2] += .2;
  const free: Point = [contact[0] + (index ? 1.7 : -1.7), contact[1] + 1.2, contact[2] + .6];
  const docked = blend(free, contact, transcriptionTimeline(progress).factorBinding);
  const enzyme = boundPolymerasePosition(progress, twist);
  const offset: Point = index ? [.85, .35, .62] : [-.75, -.38, .52];
  const carried = enzyme.map((value, axis) => value + offset[axis]) as Point;
  return blend(docked, carried, transcriptionTimeline(progress).polymeraseBinding);
}

export function rnaPoint(s: number, progress: number, twist = 0, time = 0): [number, number, number] {
  const root = polymerasePosition(progress, twist);
  const growth = transcriptionTimeline(progress).elongation;
  const length = (1 + (transcriptionSite(progress) - .17) * 8.6) * growth;
  return [
    root[0] - .18 - Math.sin(s * Math.PI * .5) * 2.6 * growth + Math.sin(s * Math.PI * 5 + time) * .18 * s,
    root[1] - .32 - s * length,
    root[2] + .63 + Math.sin(s * Math.PI * 4 + time) * .20 * s
  ];
}
