import { useEffect, useRef } from 'react';

import { useAuth } from '@/lib/auth-store';
import { useGameStore } from '@/lib/game-store';
import { syncLibrary, syncLists } from '@/lib/sync/sync-service';

// Déclenche la synchronisation §9.5 automatiquement à la connexion, sans
// vivre DANS auth-store.tsx : AuthProvider et GameStoreProvider restent deux
// sources de vérité distinctes et volontairement séparées (voir le
// commentaire d'AuthProvider) — ce hook, lui, a le droit de dépendre des
// deux, à condition d'être appelé depuis un composant monté SOUS les deux
// providers (voir app/_layout.tsx).
//
// Watch sur la TRANSITION de statut, pas sur 'signedIn' directement : sinon
// un second rendu pendant que status === 'signedIn' redéclencherait une
// synchro à chaque fois plutôt qu'une seule fois par connexion réelle. Le
// ref part de la valeur INITIALE de status ('loading' tant que le premier
// getSession() n'a pas répondu, voir AuthProvider) — la confirmation d'une
// session déjà persistée au démarrage de l'app est donc, elle aussi, une
// vraie transition vers 'signedIn' de ce point de vue, et déclenche bien
// une synchro. C'est voulu : sans ça, quelqu'un qui reste connecté pendant
// des semaines ne bénéficierait jamais de la synchro automatique, seulement
// du bouton manuel des réglages.
export function useSignInSync() {
  const { status, session } = useAuth();
  const { games, lists, applySyncedGames, applySyncedLists } = useGameStore();
  const previousStatus = useRef(status);

  useEffect(() => {
    const wasSignedIn = previousStatus.current === 'signedIn';
    previousStatus.current = status;
    if (wasSignedIn || status !== 'signedIn') return;

    const userId = session?.user?.id;
    if (!userId) return;
    // Bibliothèque d'abord : `syncLists` a besoin des lignes `user_games`
    // distantes déjà créées pour traduire l'appartenance aux listes (voir
    // sync-service.ts) — un jeu de la Wishlist qui vient tout juste de
    // monter (portée élargie par les listes) doit exister côté distant
    // AVANT que list_games ne tente de le référencer.
    syncLibrary(userId, games, lists, applySyncedGames).then(() => {
      syncLists(userId, games, lists, applySyncedLists);
    });
    // `games`/`lists` sont volontairement absents des dépendances : cet effet ne doit
    // se redéclencher qu'à un changement de statut/session RÉEL (voir le
    // commentaire ci-dessus), jamais à chaque mutation de la bibliothèque —
    // la garde `wasSignedIn` l'empêcherait de toute façon de resynchroniser
    // tant que le statut reste 'signedIn', mais un jeu qui change pendant
    // qu'on est déjà connecté n'a de toute façon rien à voir avec CETTE
    // synchro-là (voir le bouton manuel des réglages pour ce cas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, applySyncedGames]);
}
