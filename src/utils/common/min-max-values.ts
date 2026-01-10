export const getAgeMinMaxValues = (position: string | undefined) => {
  let min = 21;
  let max = 30;

  switch (position) {
    case "QB":
      max = 35;
      break;
    case "RB":
      max = 28;
      break;
    case "WR":
      max = 28;
      break;
    case "TE":
      max = 32;
      break;
    default:
      break;
  }

  return { min, max };
};

export const ktcMinMax = {
  min: 1000,
  max: 8000,
};

export const getDraftClassMinMaxValues = (season: number) => {
  return {
    min: season - 10,
    max: season,
  };
};
