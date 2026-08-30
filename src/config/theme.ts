export type PillColor = {
  bg: string;
  fg: string;
};

export type LinkTreeTheme = {
  colors: {
    cream: string;
    ink: string;
    dim: string;
    rose: string;
    brown: string;
    denim: string;
    latte: string;
    border: string;
    scrollTrack: string;
    scrollThumb: string;
    scrollThumbHover: string;
    spiralFront: string;
  };
  pillColors: PillColor[];
};

export const theme: LinkTreeTheme = {
  colors: {
    cream: "#2D0B4E",
    ink: "#F3EAFF",
    dim: "#9D89C9",
    rose: "#2A1745",
    brown: "#FFD60A",
    denim: "#5C3B8C",
    latte: "#1C0F2E",
    border: "rgba(255,214,10,0.25)",
    scrollTrack: "rgba(28,15,46,0.5)",
    scrollThumb: "linear-gradient(180deg, rgba(177,78,255,0.68), rgba(255,214,10,0.58))",
    scrollThumbHover: "linear-gradient(180deg, rgba(255,214,10,0.78), rgba(177,78,255,0.74))",
    spiralFront: "#FFD60A"
  },
  pillColors: [
    { bg: "#B14EFF", fg: "#0D0714" },
    { bg: "#FFD60A", fg: "#0D0714" },
    { bg: "#5C3B8C", fg: "#F3EAFF" },
    { bg: "#2A1745", fg: "#F3EAFF" }
  ]
};
