// Type constraint to ensure T is an enum with string values
type StringEnum = Record<string, string>;

export class ErrorBase<T extends StringEnum> extends Error {
  constructor(
    public name: T[keyof T],
    public message: string = '',
    public cause?: any,
  ) {
    super();
  }
}
