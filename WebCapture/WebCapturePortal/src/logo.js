// SPECS Inc. 2027
// The official SPECS wordmark (SPECS-Wordmark-Light-2.svg from the brand folder), as vector paths so it stays sharp at any
// export size and can be drawn in any colour. assets/specs-logo*.svg|png are the same artwork.

export const LOGO_WIDTH = 1251.28;
export const LOGO_HEIGHT = 186.52;
export const LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;

const PATHS = [
  "M399.94,3.59h-129.13v179.35h35.87v-73.53h93.26c32.28,0,53.8-21.16,53.8-52.01S432.22,3.59,399.94,3.59ZM395.82,77.12h-89.14v-41.25h89.14c19.53,0,22.7,9.98,22.7,20.62s-3.17,20.62-22.7,20.62Z",
  "M136.3,128.05c0-14.35-15.78-20.45-51.65-20.45C27.98,107.61,3.59,92.54,3.59,56.31S32.28,0,86.09,0c49.5,0,82.5,22.96,82.5,57.39h-35.87c0-15.07-18.65-25.11-46.63-25.11-30.49,0-46.63,8.25-46.63,24.03,0,13.63,14.35,19.01,48.42,19.01,59.18,0,84.29,16.14,84.29,52.73s-30.13,58.47-86.09,58.47C34.43,186.52,0,163.56,0,129.13h35.87c0,15.06,20.09,25.11,50.22,25.11,32.64,0,50.22-9.33,50.22-26.18Z",
  "M579.81,35.87v41.25h104.02v32.28h-104.02v41.25h139.89v32.28h-175.76V3.59h175.76v32.28h-139.89Z",
  "M1215.41,128.05c0-14.35-15.78-20.45-51.65-20.45-56.67,0-81.06-15.06-81.06-51.29S1111.39,0,1165.2,0c49.5,0,82.5,22.96,82.5,57.39h-35.87c0-15.07-18.65-25.11-46.63-25.11-30.49,0-46.63,8.25-46.63,24.03,0,13.63,14.35,19.01,48.42,19.01,59.18,0,84.29,16.14,84.29,52.73s-30.13,58.47-86.09,58.47c-51.65,0-86.09-22.96-86.09-57.39h35.87c0,15.06,20.09,25.11,50.22,25.11,32.64,0,50.22-9.33,50.22-26.18Z",
  "M949.14,115.86c-7.84,21.93-27.32,36.59-51.88,36.59-32.28,0-55.6-25.11-55.6-59.18s23.32-59.18,55.6-59.18c24.59,0,44.08,14.39,51.91,36.59h39.04C978.73,28.61,943.36,0,897.26,0c-53.8,0-93.26,39.46-93.26,93.26s39.46,93.26,93.26,93.26c46.1,0,81.47-28.61,90.95-70.66h-39.07Z"
];

/** The logo as an SVG document in one colour (any CSS colour). The brand's light version is #f3f3f3. */
export function logoSvg(color = "#f3f3f3") {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + LOGO_WIDTH + " " + LOGO_HEIGHT + '" width="' + LOGO_WIDTH + '" height="' + LOGO_HEIGHT +
    '"><g fill="' + color + '">' + PATHS.map((d) => '<path d="' + d + '"/>').join("") + "</g></svg>"
  );
}

export const LOGO_PLACES = {
  "top-left": [0, 0],
  "top-center": [0.5, 0],
  "top-right": [1, 0],
  "middle-left": [0, 0.5],
  center: [0.5, 0.5],
  "middle-right": [1, 0.5],
  "bottom-left": [0, 1],
  "bottom-center": [0.5, 1],
  "bottom-right": [1, 1]
};

export const LOGO_DEFAULT = {on: true, color: "white", place: "bottom-right", size: 0.18};

/** Where the logo goes on a canvas: {x, y, w, h} in pixels. `size` is the logo's width as a fraction of the canvas width. */
export function logoRect(width, height, logo) {
  const o = Object.assign({}, LOGO_DEFAULT, logo || {});
  const w = Math.max(8, width * Math.min(0.6, Math.max(0.04, o.size)));
  const h = w / LOGO_ASPECT;
  const margin = Math.min(width, height) * 0.045;
  const [fx, fy] = LOGO_PLACES[o.place] || LOGO_PLACES["bottom-right"];
  return {x: margin + fx * (width - 2 * margin - w), y: margin + fy * (height - 2 * margin - h), w, h};
}
