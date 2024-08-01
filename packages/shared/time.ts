const ONE_SECOND = 1_000; // ms

export const seconds = (s: number) => ONE_SECOND * s;
export const minutes = (m: number) => seconds(60) * m;
