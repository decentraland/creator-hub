import InfoTooltip from '../../../ui/InfoTooltip/InfoTooltip';

// The param's identifier is what the creator sees, so present it readably:
// camelCase / snake_case / kebab-case -> spaced, first letter capitalized
// (e.g. `activatedBy` -> "Activated By", `audioClipUrl` -> "Audio Clip Url").
export function formatLabel(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function labelWithTooltip(name: string, tooltip?: string) {
  const label = formatLabel(name);
  if (!tooltip) return label;
  return (
    <>
      {label} <InfoTooltip text={tooltip} />
    </>
  );
}
