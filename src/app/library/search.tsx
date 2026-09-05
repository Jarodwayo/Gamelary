import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiUrl } from '@/lib/api-url';
import { useGameStore } from '@/lib/game-store';
import { slugify } from '@/lib/slug';

type SearchStatus = 'idle' | 'loading' | 'found' | 'not-found';
type SearchResult = { id: string; title: string; platform: string };

// Recherche à la volée sur IGDB (réutilise /api/games?title=, déjà utilisé
// par useGame) plutôt qu'un vrai moteur de recherche : suffisant pour
// retrouver un jeu précis par nom, pas pour une recherche floue/à facettes.
export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const store = useGameStore();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [result, setResult] = useState<SearchResult | null>(null);

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setStatus('loading');
    try {
      const response = await fetch(apiUrl(`/api/games?title=${encodeURIComponent(trimmed)}`));
      const data: { title: string | null; platform: string | null } = await response.json();
      if (!data.title) {
        setResult(null);
        setStatus('not-found');
        return;
      }
      const found: SearchResult = {
        id: slugify(data.title),
        title: data.title,
        platform: data.platform ?? 'Plateforme inconnue',
      };
      store.registerCatalogGame(found);
      setResult(found);
      setStatus('found');
    } catch {
      setResult(null);
      setStatus('not-found');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          placeholder="Titre d'un jeu"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          autoFocus
        />

        {status === 'loading' && <ActivityIndicator style={styles.spinner} color={theme.accent} />}

        {status === 'not-found' && (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            Aucun jeu trouvé pour « {query.trim()} ».
          </ThemedText>
        )}

        {status === 'found' && result && (
          <Pressable
            onPress={() => router.push(`/library/${result.id}`)}
            style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
            <ThemedView style={styles.coverWrap}>
              <GameCover title={result.title} />
            </ThemedView>
            <ThemedView style={styles.resultText}>
              <ThemedText type="smallBold">{result.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {result.platform}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  spinner: {
    marginTop: Spacing.four,
  },
  message: {
    marginTop: Spacing.four,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  coverWrap: {
    width: 64,
  },
  resultText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
