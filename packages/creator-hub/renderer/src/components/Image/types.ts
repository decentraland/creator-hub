import { type ImgHTMLAttributes } from 'react';

export type Props = ImgHTMLAttributes<HTMLImageElement> &  {
  src: string;
  fallbackSrc?: string;
  alt: string;
}
