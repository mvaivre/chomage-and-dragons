import { extend } from "@pixi/react";
import { Container, Graphics, MeshPlane, Sprite, Text } from "pixi.js";
// `renderer.prepare` uploads a room's art under the door fade instead of on its first frame.
import "pixi.js/prepare";

/**
 * Catalogue des classes Pixi exposées en JSX.
 *
 * Sans cet appel, `<pixiContainer>` et ses voisins n'existent pas. Il vit dans son
 * propre module pour que chaque canvas — le jeu, mais aussi le portrait de l'écran
 * de sélection — puisse l'importer sans dépendre de l'autre.
 */
extend({ Container, Graphics, MeshPlane, Sprite, Text });
