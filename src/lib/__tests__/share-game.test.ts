import { gameShareMessage, steamStoreLink } from '../share-game';

describe('steamStoreLink', () => {
  test('jeu Steam (steamAppId connu) : renvoie la page boutique', () => {
    expect(steamStoreLink(413150)).toBe('https://store.steampowered.com/app/413150');
  });

  test("pas d'app Steam pour ce jeu : pas de lien", () => {
    expect(steamStoreLink(undefined)).toBeNull();
  });
});

describe('gameShareMessage', () => {
  test('jeu Steam : le lien boutique suit le titre, sur sa propre ligne', () => {
    expect(gameShareMessage('Stardew Valley', 413150)).toBe(
      'Stardew Valley sur Gamelary\nhttps://store.steampowered.com/app/413150'
    );
  });

  test('jeu sans steamAppId (ex. entrée manuelle) : juste le titre, aucun lien inventé', () => {
    expect(gameShareMessage('Hollow Knight', undefined)).toBe('Hollow Knight sur Gamelary');
  });
});
