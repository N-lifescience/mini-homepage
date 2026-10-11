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
    cream: "#F4F8E9",
    ink: "#30482E",
    dim: "#687A5C",
    rose: "#E7EFCF",
    brown: "#426B3E",
    denim: "#8DAA6D",
    latte: "#FFFEF6",
    border: "#C5D6B7",
    scrollTrack: "#F1F5E8",
    scrollThumb: "#A9BF90",
    scrollThumbHover: "#789861",
    spiralFront: "#B6CE91"
  },
  pillColors: [
    { bg: "#DDEBCB", fg: "#30482E" },
    { bg: "#F6E9B4", fg: "#614B24" },
    { bg: "#D6EBE2", fg: "#355C4D" },
    { bg: "#F3DBD1", fg: "#754E40" }
  ]
};
