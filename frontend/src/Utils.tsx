export const randomBrandColorFromString = (input: string) => {
  const brandColors = [
    "#00bef0",
    "#00FBB9",
    "#a95adf",
    "#651f45",
    "#ff673c",
    "#004658",
    "#005c44",
    "#4d2966",
    "#a53f0c"
  ];
  const intHash = Math.abs(getIntHashFromString(input));
  return brandColors[intHash % brandColors.length];
};

// From: https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
const getIntHashFromString = function(input: string) {
  var hash = 0,
    i,
    chr;
  if (input.length === 0) return hash;
  for (i = 0; i < input.length; i++) {
    chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
};
