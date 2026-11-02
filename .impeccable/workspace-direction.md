# Atelier Fretwave — intégration approuvée

Mode : Operate. Périmètre : toutes les routes de l'application, ordinateur et téléphone, Synthwave Neon et Aube. Références approuvées : mocks/fretwave-style-actuel/ordinateur.png et telephone.png. Demande du 2026-11-01, branche refonte/nouveau-design.

## Direction contract

THESIS : une boîte à outils pour jouer, navigation latérale persistante et surface de travail centrée sur la tablature ; le téléphone prépare la session puis joue en paysage.

OWN-WORLD : tokens Synthwave/Aube existants, traits de 2 px, angles de 2 px, ombres dures, accents magenta pour l'action et cyan pour les contrôles secondaires. Aucun nouveau caractère ni dépendance. Le décor utilise le canvas existant.

STORY : choisir une gamme, sa position et un outil, régler le tempo et lancer. Révisions au micro et fonctionnement sans compte conservés.

FIRST VIEWPORT : rail gauche 184–220 px au bureau ; titre et sélecteurs puis onglets au-dessus du jeu ; positions à gauche du canvas ; transport en bas. Téléphone : marque et réglages en haut, quatre destinations en bas ; titre, choix et positions puis aperçu et préparation du jeu.

FORM : maquette fournie et explicitement approuvée ; seed:613b09ee0d5cf730. Les nombres illustratifs sont remplacés par l'état musical réel. Le moteur de tablature, les seuils, le micro et le journal sont conservés. L'aperçu téléphone n'est pas le mode de jeu : paysage conservé. Les détails, la progression et le choix d'instrument restent accessibles. Le compte reste dans Réglages.

FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Validation : compilation, Vitest, parcours des outils et matrice 12 routes × 8 largeurs × 2 thèmes. Captures : review/workspace. Les maquettes sont des références ; aucun PNG n'est utilisé comme interface.
