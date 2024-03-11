type StringRating = {
  target: string;
  rating: number;
};

type BestMatchResult = {
  ratings: StringRating[];
  bestMatch: StringRating;
  bestMatchIndex: number;
};

/**
 * Calculates the similarity between two strings by comparing bigrams (pairs of adjacent characters) 
 * and returns a score between 0 and 1, where 1 indicates a perfect match.
 */
export function compareTwoStrings(first: string, second: string): number {
  first = first.replace(/\s+/g, '');
  second = second.replace(/\s+/g, '');

  if (first === second) return 1;
  if (first.length < 2 || second.length < 2) return 0;

  const firstBigrams = new Map<string, number>();
  for (let i = 0; i < first.length - 1; i++) {
    const bigram = first.substring(i, i + 2);
    const count = firstBigrams.get(bigram) || 0;
    firstBigrams.set(bigram, count + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < second.length - 1; i++) {
    const bigram = second.substring(i, i + 2);
    const count = firstBigrams.get(bigram) || 0;

    if (count > 0) {
      firstBigrams.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (first.length + second.length - 2);
}

/**
 * Compares a main string against an array of target strings, computes similarity scores using compareTwoStrings, 
 * and identifies the best matching string along with its index and scores for all target strings.
 */
export function findBestMatch(mainString: string, targetStrings: string[]): BestMatchResult {
  if (!areArgsValid(mainString, targetStrings))
    throw new Error('Bad arguments: First argument should be a string, second should be an array of strings');

  const ratings: StringRating[] = targetStrings.map(target => ({
    target,
    rating: compareTwoStrings(mainString, target),
  }));

  const bestMatchIndex = ratings.reduce(
    (bestIndex, current, index, array) => (current.rating > array[bestIndex].rating ? index : bestIndex),
    0,
  );

  return {
    ratings,
    bestMatch: ratings[bestMatchIndex],
    bestMatchIndex,
  };
}

function areArgsValid(mainString: string, targetStrings: string[]): boolean {
  return typeof mainString === 'string' && Array.isArray(targetStrings) && targetStrings.length > 0;
}
