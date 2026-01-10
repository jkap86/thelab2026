export const getPlayerPoints = (
  scoringSettings: { [key: string]: number },
  stats: { [key: string]: number }
) => {
  return Object.keys(stats)
    .filter((key) => Object.keys(scoringSettings).includes(key))
    .reduce((acc, key) => {
      return acc + stats[key] * scoringSettings[key];
    }, 0);
};
