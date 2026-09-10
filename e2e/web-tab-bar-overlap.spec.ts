import { test, expect } from '@playwright/test';

// Sur le bundle web, la barre d'onglets est une pilule en position absolue
// (voir src/components/app-tabs.web.tsx) : elle se superpose au contenu.
// Un contrôle situé à sa hauteur est alors visuellement masqué ET
// intapable — sans erreur, sans warning, et uniquement sur web.
//
// Ce piège est déjà passé trois fois. D'abord la cloche du Profil, quand
// la barre était en HAUT. Puis les cinq filtres de la Bibliothèque, qui
// étaient centrés à 65 px sous une barre haute de 76 px. Enfin le
// déplacement de la barre vers le bas n'a pas supprimé le recouvrement, il
// l'a déplacé — d'où `BottomTabInset` (110 dp sur web) que les écrans
// doivent réserver.
//
// Le test ne compare pas des pixels : il fait un vrai hit-testing
// (elementFromPoint) au centre de chaque élément interactif, donc il
// répond à la seule question qui compte — « un utilisateur peut-il cliquer
// dessus ? » — sans se casser au moindre changement de mise en page. Il
// vérifie deux fois par écran : à l'ouverture, puis **après défilement
// jusqu'en bas**, là où se trouvent justement les boutons principaux
// qu'une barre basse peut recouvrir.
//
// Les deux thèmes sont couverts : la superposition n'en dépend pas, mais
// un écran rendu conditionnellement selon le thème passerait autrement à
// travers les mailles.

const ROUTES = [
  ['/library', 'Bibliothèque'],
  ['/explorer', 'Explorer'],
  ['/profile', 'Profil'],
  ['/library/search', 'Recherche'],
  ['/profile/stats', 'Statistiques'],
  ['/profile/notifications', 'Notifications'],
  ['/profile/edit', 'Modifier le profil'],
  ['/profile/create-list', 'Créer une liste'],
  ['/profile/help', 'Aide et idées'],
  ['/profile/settings', 'Réglages'],
  ['/profile/settings-artwork', 'Affiche de la page titre'],
] as const;

type Covered = { texte: string; y: number; recouvertPar: string };
type Rect = { top: number; bottom: number; left: number; right: number };

// Repérage de la barre, puis contrôles recouverts, dans UNE seule
// évaluation : la barre est identifiée par un élément du DOM, et c'est cet
// élément-là qu'il faut exclure — pas « tout lien vers /explorer ».
// Un premier jet excluait les liens par leur destination : sur le Profil,
// le lien de contenu « Explorer des jeux » pointe lui aussi vers
// /explorer, il aurait donc été écarté du contrôle alors que c'est
// exactement le genre d'élément que ce test doit surveiller.
async function inspect(page: import('@playwright/test').Page): Promise<{ bar: Rect | null; covered: Covered[] }> {
  return page.evaluate(() => {
    const TAB_PATHS = ['/library', '/explorer', '/profile'];
    const hasTabLink = (root: Element, path: string) =>
      [...root.querySelectorAll('a')].some((a) => new URL(a.href, location.href).pathname === path);

    // Parmi tous les éléments en position absolue contenant les trois
    // onglets, le PLUS PETIT est la barre — la racine de page les contient
    // aussi. Repérée par son contenu, jamais par une position en dur :
    // elle a déjà déménagé du haut vers le bas une fois.
    let barEl: HTMLElement | null = null;
    let barArea = Infinity;
    for (const node of document.querySelectorAll('*')) {
      const el = node as HTMLElement;
      if (getComputedStyle(el).position !== 'absolute') continue;
      if (!TAB_PATHS.every((path) => hasTabLink(el, path))) continue;
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > 0 && area < barArea) {
        barArea = area;
        barEl = el;
      }
    }
    if (!barEl) return { bar: null, covered: [] };

    const r = barEl.getBoundingClientRect();
    const bar: Rect = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };

    const covered: Covered[] = [];
    const nodes = document.querySelectorAll(
      'a, button, input, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
    );
    for (const node of nodes) {
      // Seuls les onglets eux-mêmes sont exclus, parce qu'ils VIVENT dans
      // la barre — pas les liens de contenu qui mènent au même écran.
      if (barEl.contains(node)) continue;

      const rect = (node as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (cy < bar.top || cy > bar.bottom || cx < bar.left || cx > bar.right) continue;

      const hit = document.elementFromPoint(cx, cy);
      const reachable = node === hit || node.contains(hit) || (hit && hit.contains(node));
      if (reachable) continue;

      covered.push({
        texte: (node.textContent || (node as HTMLInputElement).placeholder || '(sans texte)')
          .trim()
          .slice(0, 50),
        y: Math.round(cy),
        recouvertPar: (hit?.textContent || hit?.tagName || '?').trim().slice(0, 40),
      });
    }
    return { bar, covered };
  });
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [route, label] of ROUTES) {
    test(`${scheme} — ${label} : aucun contrôle sous la barre d'onglets`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(route);
      // Laisse le bundle Metro monter l'écran et le store se charger.
      await page.waitForTimeout(2500);

      const atOpen = await inspect(page);
      // Si la barre devenait introuvable (nouvelle refonte de la
      // navigation web), ce test passerait au vert en ne vérifiant plus
      // rien : on préfère qu'il échoue bruyamment.
      expect(atOpen.bar, "barre d'onglets web introuvable — ce test ne vérifierait plus rien").not.toBeNull();
      expect(
        atOpen.covered,
        `contrôles recouverts à l'ouverture de ${route} — réserver BottomTabInset (voir src/constants/theme.ts)`
      ).toEqual([]);

      // Puis en bas de page : c'est là que vivent les boutons principaux
      // ("Créer la liste", "Enregistrer"...), donc là qu'une barre basse
      // fait le plus de dégâts.
      await page.evaluate(() => {
        const scroller = document.scrollingElement ?? document.documentElement;
        scroller.scrollTop = scroller.scrollHeight;
        for (const node of document.querySelectorAll('*')) {
          if (node.scrollHeight > node.clientHeight + 8) node.scrollTop = node.scrollHeight;
        }
      });
      await page.waitForTimeout(600);

      const atBottom = await inspect(page);
      expect(atBottom.bar).not.toBeNull();
      expect(
        atBottom.covered,
        `contrôles recouverts en bas de ${route} — réserver BottomTabInset (voir src/constants/theme.ts)`
      ).toEqual([]);
    });
  }
}
