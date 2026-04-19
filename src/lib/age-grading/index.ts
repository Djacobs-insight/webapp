import wmaData from "../../data/wma-factors.json";

type Gender = "M" | "F";

interface AgeGradingResult {
  percentage: number;
  gradedTimeSeconds: number;
}

const factors = wmaData["5km"].factors;
const openStandards = wmaData["5km"].openStandardSeconds;

function getAgeFactor(age: number, gender: Gender): number | null {
  const genderFactors = factors[gender] as Record<string, number>;
  const clampedAge = Math.max(5, Math.min(100, Math.floor(age)));
  const factor = genderFactors[String(clampedAge)];
  return factor ?? null;
}

export function calculateAgeOnDate(birthday: Date, raceDate: Date): number {
  let age = raceDate.getFullYear() - birthday.getFullYear();
  const monthDiff = raceDate.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && raceDate.getDate() < birthday.getDate())) {
    age--;
  }
  return age;
}

export function calculateAgeGradedPercentage(
  finishTimeSecs: number,
  age: number,
  gender: Gender
): AgeGradingResult | null {
  if (finishTimeSecs <= 0 || age < 5 || age > 100) return null;

  const factor = getAgeFactor(age, gender);
  if (factor === null) return null;

  const openStandard = openStandards[gender];
  const gradedTimeSeconds = finishTimeSecs * factor;
  const percentage = (openStandard / gradedTimeSeconds) * 100;

  return {
    percentage: Math.round(percentage * 100) / 100,
    gradedTimeSeconds: Math.round(gradedTimeSeconds * 100) / 100,
  };
}
