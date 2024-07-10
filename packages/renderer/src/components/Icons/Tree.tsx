import cx from 'classnames';

import type { CommonProps } from './types';

export function Tree({ className }: CommonProps) {
  return (
    <div className={cx('Icon', className)}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10.7829 15.3424V16.7893C10.7824 16.9117 10.7338 17.0289 10.6479 17.1152C10.562 17.2015 10.4457 17.25 10.3245 17.25H8.48794C8.36653 17.25 8.25008 17.2014 8.16414 17.1148C8.0782 17.0283 8.02979 16.9109 8.02954 16.7883V15.3424H10.7829ZM13.1042 11.8362L14.1897 13.7281C14.2295 13.7983 14.2502 13.8779 14.25 13.9588C14.2498 14.0397 14.2285 14.1192 14.1883 14.1892C14.1481 14.2592 14.0905 14.3174 14.0211 14.3579C13.9516 14.3984 13.8729 14.4198 13.7927 14.42H4.95725C4.87708 14.4198 4.79835 14.3984 4.72894 14.3579C4.65953 14.3174 4.60186 14.2592 4.56169 14.1892C4.52152 14.1192 4.50025 14.0397 4.5 13.9588C4.49976 13.8779 4.52055 13.7983 4.5603 13.7281L5.64681 11.8362H13.1042ZM12.3493 8.32899L13.4358 10.2219C13.4755 10.2921 13.4963 10.3717 13.4961 10.4526C13.4958 10.5335 13.4746 10.613 13.4344 10.683C13.3942 10.753 13.3365 10.8112 13.2671 10.8517C13.1977 10.8922 13.119 10.9136 13.0388 10.9138H5.71216C5.63198 10.9136 5.55326 10.8922 5.48385 10.8517C5.41443 10.8112 5.35677 10.753 5.31659 10.683C5.27642 10.613 5.25515 10.5335 5.25491 10.4526C5.25466 10.3717 5.27545 10.2921 5.3152 10.2219L6.40074 8.32899H12.3493ZM9.77342 1.731L12.635 6.71468C12.6748 6.78496 12.6956 6.86453 12.6953 6.94545C12.6951 7.02636 12.6738 7.1058 12.6336 7.17583C12.5935 7.24586 12.5358 7.30403 12.4664 7.34454C12.397 7.38504 12.3183 7.40647 12.2381 7.40667H6.5129C6.43272 7.40647 6.354 7.38504 6.28459 7.34454C6.21518 7.30403 6.15751 7.24586 6.11734 7.17583C6.07716 7.1058 6.05589 7.02636 6.05565 6.94545C6.0554 6.86453 6.07619 6.78496 6.11594 6.71468L8.97755 1.731C9.01806 1.66073 9.07612 1.60241 9.14595 1.56187C9.21578 1.52133 9.29493 1.5 9.37549 1.5C9.45604 1.5 9.53519 1.52133 9.60502 1.56187C9.67485 1.60241 9.73292 1.66073 9.77342 1.731Z"
          fill="white"
        />
      </svg>
    </div>
  );
}