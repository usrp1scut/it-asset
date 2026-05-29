/**
 * Colored-square wrapper around the device line-icons in Icon.tsx.
 *
 * Ports `AssetTypeIcon` from design_handoff_it_asset/prototype/ui.jsx:207-225.
 * The icon name and color come from the AssetType row (admin-configurable);
 * when either is missing we fall back to a neutral box so a legacy or
 * not-yet-linked asset still renders without a hole.
 */

import Icon, { type IconName } from './Icon'

export interface AssetTypeIconProps {
  icon?: string | null
  color?: string | null
  size?: number
  radius?: number
}

// Pure pixel arithmetic on a "#RRGGBB" string → "#RRGGBBaa" with low alpha
// for the tile background. Falls back to neutral grey when the input isn't
// a 7-char hex (e.g. legacy types still on default).
function tileBg(color: string | null | undefined): string {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return '#F2F3F5'
  return color + '1f' // ~12% alpha — matches the prototype palette feel
}

export default function AssetTypeIcon({
  icon,
  color,
  size = 36,
  radius = 8,
}: AssetTypeIconProps) {
  const name = (icon || 'device') as IconName
  const fg = color || '#86909C'
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: tileBg(color),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={name} size={Math.round(size * 0.55)} color={fg} />
    </div>
  )
}
