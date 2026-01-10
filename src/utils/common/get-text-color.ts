export const getTextColor = (
  value: number,
  min: number,
  max: number,
  avg: number,
  reverse: boolean = false
) => {
  if (!reverse && value > avg) {
    const x = ((value - avg) / (max - avg)) * 255;

    return {
      color: `rgb(${255 - x}, ${255}, ${255 - x})`,
    };
  } else if (!reverse && value < avg) {
    const x = ((avg - value) / (avg - min)) * 255;

    return {
      color: `rgb(${255}, ${255 - x}, ${255 - x})`,
    };
  } else if (reverse && value < avg) {
    const x = ((avg - value) / (avg - min)) * 255;

    return {
      color: `rgb(${255 - x}, ${255}, ${255 - x})`,
    };
  } else if (reverse && value > avg) {
    const x = ((value - avg) / (max - avg)) * 255;

    return {
      color: `rgb(${255}, ${255 - x}, ${255 - x})`,
    };
  } else {
    return {
      color: `rgb(255, 255, 255)`,
    };
  }
};
