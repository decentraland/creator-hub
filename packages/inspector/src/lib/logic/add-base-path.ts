export const addBasePath = (basePath: string, path: string): string => {
  if (path && basePath && !path.startsWith(basePath)) {
    return `${basePath}/${path}`;
  }
  return path;
};
