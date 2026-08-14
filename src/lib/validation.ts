import { normalizeMobile } from './normalize';

export const isIranianMobile = (value: string) => /^09[0-9]{9}$/.test(normalizeMobile(value));
