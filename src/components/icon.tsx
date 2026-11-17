import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { Palette } from '@/constants/theme';

/** SF Symbols en iOS, Material Symbols en Android y web. */
const ICONS = {
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  remove: { ios: 'minus', android: 'remove', web: 'remove' },
  addCircle: { ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' },
  checkCircle: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  closeCircle: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  trophy: { ios: 'trophy.fill', android: 'trophy', web: 'trophy' },
  chart: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  external: { ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' },
  film: { ios: 'film', android: 'movie', web: 'movie' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  key: { ios: 'key.fill', android: 'key', web: 'key' },
  table: { ios: 'tablecells', android: 'table', web: 'table' },
  list: { ios: 'list.number', android: 'format_list_numbered', web: 'format_list_numbered' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  scale: { ios: 'scalemass', android: 'balance', web: 'balance' },
  people: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
  critic: { ios: 'text.quote', android: 'rate_review', web: 'rate_review' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  masks: { ios: 'theatermasks.fill', android: 'theater_comedy', web: 'theater_comedy' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  minusCircle: { ios: 'minus.circle.fill', android: 'do_not_disturb_on', web: 'do_not_disturb_on' },
} satisfies Record<string, Extract<SymbolViewProps['name'], object>>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = Palette.text,
  style,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} style={style} />;
}
