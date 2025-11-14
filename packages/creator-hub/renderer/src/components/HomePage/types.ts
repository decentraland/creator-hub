export type CardBannerProps = {
  image: string;
  title: string;
  onClick?: () => void;
  'data-testid'?: string;
};

export type CardItemProps = {
  title: string;
  icon?: JSX.Element;
  onClick?: () => void;
};

export type SignInCardProps = {
  onClickSignIn: () => void;
};
