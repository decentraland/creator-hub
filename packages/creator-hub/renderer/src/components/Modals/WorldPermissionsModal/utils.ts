/**
 * Get the resumed address of a given address
 * @example
 * getResumedAddress('0x1234567890abcdef1234567890abcdef12345678') // '0x1234...345678'
 */
export const getResumedAddress = (address: string) =>
  address.substring(0, 6) + '...' + address.substring(address.length - 6);
