import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  // linkPrimary est la seule variante à porter une couleur par défaut autre
  // que le texte principal (l'accent, pas un bleu ad hoc) ; themeColor reste
  // prioritaire si l'appelant le précise explicitement.
  const resolvedColor = theme[themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text')];

  return (
    <Text
      style={[
        { color: resolvedColor },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Une police custom chargée par nom (voir Fonts, src/constants/theme.ts)
// ignore fontWeight — chaque variante ci-dessous pointe donc directement
// vers la famille du poids voulu plutôt que de combiner une famille
// unique avec un fontWeight numérique (qui ne ferait rien de visible).
const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.sans.medium,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.sans.bold,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Fonts.sans.medium,
  },
  title: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: Fonts.sans.semiBold,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: Fonts.sans.semiBold,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: Fonts.sans.regular,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: Fonts.sans.semiBold,
  },
  code: {
    fontFamily: Fonts.mono.medium,
    fontSize: 12,
  },
});
