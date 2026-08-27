import { extend } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";

/**
 * Catalogue des classes Pixi exposées en JSX.
 *
 * Sans cet appel, `<pixiContainer>` et ses voisins n'existent pas. Il vit dans son
 * propre module pour que chaque canvas — le jeu, mais aussi le portrait de l'écran
 * de sélection — puisse l'importer sans dépendre de l'autre.
 */
extend({ Container, Graphics, Sprite, Text });
