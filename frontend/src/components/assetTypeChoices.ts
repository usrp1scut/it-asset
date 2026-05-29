/**
 * Picker options for the AssetTypes admin Modal — the icon + color a type can
 * carry. Split out of AssetTypeIcon.tsx so that component file only exports a
 * component (keeps Vite fast-refresh happy).
 *
 * Adding a new device icon means: add the path in Icon.tsx, then add it here.
 */
import type { IconName } from './Icon'

export const ICON_CHOICES: { name: IconName; label: string }[] = [
  { name: 'laptop', label: '笔记本' },
  { name: 'monitor', label: '显示器' },
  { name: 'phone', label: '手机' },
  { name: 'tablet', label: '平板' },
  { name: 'keyboard', label: '键盘' },
  { name: 'mouse', label: '鼠标' },
  { name: 'headphones', label: '耳机' },
  { name: 'speaker', label: '音箱' },
  { name: 'camera', label: '摄像头' },
  { name: 'dock', label: '扩展坞' },
  { name: 'cable', label: '线材' },
  { name: 'network', label: '网络设备' },
  { name: 'server', label: '服务器' },
  { name: 'printer', label: '打印机' },
  { name: 'device', label: '其他设备' },
]

// Same Lark-aligned palette the prototype used (ui.jsx:210-217).
export const COLOR_CHOICES: string[] = [
  '#3370FF', // 蓝
  '#7E5EE5', // 紫
  '#D17A00', // 橙
  '#00863C', // 绿
  '#0086A8', // 青
  '#D4380D', // 红
  '#C72060', // 粉
  '#4E5969', // 灰
]
