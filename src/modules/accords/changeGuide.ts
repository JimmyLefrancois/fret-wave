/**
 * Module Accords — bloc pédagogique « Changer d'accord » (D106), en données.
 *
 * Inspiré du guide MyGuitare « changer d'accords à la guitare », reformulé pour l'app : l'exercice
 * mesuré existe déjà (étape Enchaîner, 30 s, temps de changement au micro), le bloc dit **comment** le
 * travailler. Aucune règle de mesure, de maîtrise ni d'XP n'en dépend : ce fichier ne décide rien.
 */

/** Les trois règles visibles sans déplier : ce qu'on retient si on ne lit rien d'autre. */
export const CHANGE_RULES: readonly string[] = [
  'Un seul changement à la fois, lentement : deux accords, pas une chanson.',
  'Les doigts restent près du manche, et ceux qui ne bougent pas restent posés (les doigts pivots).',
  'Avec le métronome, ne ralentis jamais le rythme pour changer : rate le temps plutôt, la main rattrapera.',
];

/** La méthode, dans l'ordre. La main droite ne joue qu'à la dernière étape. */
export const CHANGE_STEPS: readonly string[] = [
  'Vérifie que chaque accord sonne seul, corde par corde.',
  'Forme le premier accord, main gauche seule.',
  'Passe très lentement au second, et regarde tes doigts : lesquels restent, lesquels se croisent.',
  'Recommence en limitant les mouvements ; quand c’est facile, pose tous les doigts en même temps.',
  'Répète dix à vingt fois, jusqu’à ce que la main soit détendue.',
  'Ajoute la main droite : gratte, puis joue les cordes une à une pour trouver celle qui grésille.',
];

/** Quand aucun doigt ne reste posé (Ré → Sol, Sol → Do) : mémoriser la forme entière. */
export const CHANGE_WHOLE_SHAPE: readonly string[] = [
  'Forme l’accord, relâche juste assez pour que les cordes remontent, puis réappuie : dix fois. La main apprend que tous les doigts arrivent ensemble.',
  'Ferme les yeux et imagine tes doigts former l’accord suivant, avant de le jouer.',
  'Repère la basse : la note grave qui donne son nom à l’accord (La à vide pour La mineur, la case 3 de la corde de La pour Do). Vise-la d’abord : elle guide le reste de la main.',
];

/** Ce qui ralentit un débutant, dit sans reproche. */
export const CHANGE_MISTAKES: readonly string[] = [
  'ralentir le rythme pendant le changement ;',
  'décoller tous les doigts loin de la touche ;',
  'accélérer avant que le geste soit stable ;',
  'crisper la main : un doigt tendu bouge moins vite ;',
  'enchaîner un accord qui grésille déjà seul.',
];
