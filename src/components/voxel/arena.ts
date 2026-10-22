import * as THREE from "three";
import { QUALITY, deviceQuality } from "./quality";
import { VoxelResources } from "./resources";

/** The minigames keep their logical hit boxes. An oblique orthographic camera
 * projects z=0 back onto exactly the same pointer coordinates. All props are meshes. */
export class VoxelPainter {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera();
  readonly resources = new VoxelResources();
  private buckets = new Map<
    string,
    {
      mat: THREE.MeshStandardMaterial;
      mesh: THREE.InstancedMesh;
      matrices: THREE.Matrix4[];
    }
  >();
  private textTextures = new Map<
    string,
    { texture: THREE.CanvasTexture; width: number; height: number }
  >();
  private sprites: THREE.Sprite[] = [];
  private usedSprites = 0;
  private object = new THREE.Object3D();
  private logicalWidth = 360;
  private logicalHeight = 280;
  private light: THREE.DirectionalLight;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "low-power",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = this.quality().shadowSize > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x183333);
    this.scene.add(new THREE.HemisphereLight(0xe2e9d7, 0x506957, 2.5));
    this.light = new THREE.DirectionalLight(0xffd99d, 3);
    this.light.position.set(-160, 260, 600);
    this.light.castShadow = this.renderer.shadowMap.enabled;
    this.light.shadow.mapSize.set(512, 512);
    Object.assign(this.light.shadow.camera, {
      left: -420,
      right: 420,
      top: 420,
      bottom: -420,
      near: 1,
      far: 1400,
    });
    this.light.shadow.normalBias = 0.6;
    this.scene.add(this.light);
  }
  private quality() {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return QUALITY[deviceQuality(window.innerWidth, window.matchMedia("(pointer: coarse)").matches,
      navigator.hardwareConcurrency, memory)];
  }
  resize(
    cssWidth: number,
    cssHeight: number,
    dpr: number,
    width: number,
    height: number,
    bleedX = 0,
    bleedY = 0,
  ) {
    this.logicalWidth = width;
    this.logicalHeight = height;
    const quality = this.quality();
    const shadows = quality.shadowSize > 0;
    this.renderer.shadowMap.enabled = shadows;
    this.light.castShadow = shadows;
    if (!shadows && this.light.shadow.map) {
      this.light.shadow.map.dispose();
      this.light.shadow.map = null;
    }
    this.renderer.domElement.dataset.shadowMode = shadows ? "realtime" : "none";
    this.renderer.setPixelRatio(Math.min(dpr, quality.dpr, Math.sqrt(quality.pixels / (cssWidth * cssHeight))));
    this.renderer.setSize(cssWidth, cssHeight, false);
    const angle = 0.24;
    this.camera.left = -width / 2 - bleedX;
    this.camera.right = width / 2 + bleedX;
    this.camera.top = (height / 2 + bleedY) * Math.cos(angle);
    this.camera.bottom = -(height / 2 + bleedY) * Math.cos(angle);
    this.camera.near = 1;
    this.camera.far = 1800;
    this.camera.position.set(0, Math.sin(angle) * 850, Math.cos(angle) * 850);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }
  begin() {
    for (const b of this.buckets.values()) b.matrices.length = 0;
    for (const sprite of this.sprites) sprite.visible = false;
    this.usedSprites = 0;
  }
  block(
    color: THREE.ColorRepresentation,
    x: number,
    y: number,
    w: number,
    h = w,
    depth = 5,
    z = 0,
    angle = 0,
    glow = false,
  ) {
    const mat = this.resources.material(color, glow),
      key = mat.uuid;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      const mesh = new THREE.InstancedMesh(this.resources.cube, mat, 512);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.resources.instances.add(mesh);
      bucket = { mat, mesh, matrices: [] };
      this.buckets.set(key, bucket);
    }
    this.object.position.set(
      x - this.logicalWidth / 2,
      this.logicalHeight / 2 - y,
      z,
    );
    this.object.scale.set(w, h, depth);
    this.object.rotation.set(0, 0, -angle);
    this.object.updateMatrix();
    bucket.matrices.push(this.object.matrix.clone());
  }
  line(
    x: number,
    y: number,
    xx: number,
    yy: number,
    color: THREE.ColorRepresentation,
    thickness = 2,
    z = 6,
  ) {
    this.block(
      color,
      (x + xx) / 2,
      (y + yy) / 2,
      Math.hypot(xx - x, yy - y),
      thickness,
      2,
      z,
      Math.atan2(yy - y, xx - x),
    );
  }
  text(
    value: string,
    x: number,
    y: number,
    size = 12,
    color = "#eadbb9",
    align: "center" | "left" | "right" = "center",
    z = 12,
  ) {
    const key = `${value}:${size}:${color}`;
    let entry = this.textTextures.get(key);
    if (!entry) {
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d")!;
      ctx.font = `600 ${size * 2}px Georgia`;
      const width = Math.ceil(ctx.measureText(value).width) + 12;
      canvas.width = width;
      canvas.height = Math.ceil(size * 3.2);
      ctx.font = `600 ${size * 2}px Georgia`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(value, width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      entry = { texture, width: width / 2, height: canvas.height / 2 };
      this.textTextures.set(key, entry);
    }
    let sprite = this.sprites[this.usedSprites++];
    if (!sprite) {
      sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: true,
          toneMapped: false,
        }),
      );
      this.sprites.push(sprite);
      this.scene.add(sprite);
    }
    sprite.material.map = entry.texture;
    sprite.material.needsUpdate = true;
    sprite.visible = true;
    sprite.position.set(
      x -
        this.logicalWidth / 2 +
        (align === "left"
          ? entry.width / 2
          : align === "right"
            ? -entry.width / 2
            : 0),
      this.logicalHeight / 2 - y,
      z,
    );
    sprite.scale.set(entry.width, entry.height / Math.cos(0.24), 1);
  }
  background(width = this.logicalWidth, height = this.logicalHeight) {
    this.block(
      0x3c5548,
      width / 2,
      height / 2,
      width + 50,
      height + 50,
      7,
      -17,
    );
    this.block(0x263b35, width / 2, height - 3, width + 40, 13, 10, -8);
    for (let i = 0; i < 12; i++)
      this.block(i % 2 ? 0x778c65 : 0x60785b, (i * width) / 11, 9, 5, 5, 5, -8);
  }
  paper(
    x: number,
    y: number,
    w = 32,
    h = 43,
    color: THREE.ColorRepresentation = 0xe2d2ac,
  ) {
    this.block(0x807457, x + 2, y + 2, w, h, 4, 0);
    this.block(color, x, y, w, h, 3, 3);
    for (let i = 0; i < 4; i++)
      this.block(
        0x9e9a7e,
        x - 2,
        y - h * 0.22 + i * h * 0.13,
        w * 0.65 - (i % 2) * w * 0.15,
        1.3,
        1,
        5,
      );
  }
  coin(
    x: number,
    y: number,
    r = 9,
    color: THREE.ColorRepresentation = 0xe5bc6a,
  ) {
    for (let row = -2; row <= 2; row++)
      this.block(
        color,
        x,
        y + row * r * 0.34,
        r * (Math.abs(row) === 2 ? 1.15 : 1.7),
        r * 0.36,
        5,
        4,
      );
    this.block(0xf0d591, x - 2, y - 2, r * 0.5, 2, 1, 8);
  }
  bird(
    x: number,
    y: number,
    size = 1,
    color: THREE.ColorRepresentation = 0xc7d1c7,
    time = 0,
  ) {
    this.block(color, x, y, 30 * size, 17 * size, 14 * size, 5);
    this.block(
      color,
      x - 14 * size,
      y - 8 * size,
      14 * size,
      15 * size,
      12 * size,
      7,
    );
    this.block(
      0xd6aa60,
      x - 25 * size,
      y - 5 * size,
      10 * size,
      5 * size,
      5 * size,
      8,
    );
    this.block(
      0x293b39,
      x - 17 * size,
      y - 10 * size,
      3 * size,
      3 * size,
      2 * size,
      15,
    );
    this.block(
      0x879c98,
      x + 3 * size,
      y - 3 * size,
      22 * size,
      (5 + Math.sin(time / 100) * 3) * size,
      7 * size,
      15,
    );
    this.block(
      color,
      x + 22 * size,
      y + 2 * size,
      16 * size,
      7 * size,
      5 * size,
      2,
    );
    for (const side of [-1, 1])
      this.block(
        0xc7a36b,
        x + side * 5 * size,
        y + 13 * size,
        2 * size,
        8 * size,
        3 * size,
        4,
      );
  }
  person(
    x: number,
    y: number,
    size = 1,
    color: THREE.ColorRepresentation = 0x807199,
  ) {
    this.block(color, x, y - 13 * size, 23 * size, 30 * size, 14 * size, 5);
    this.block(0xe0bc96, x, y - 37 * size, 18 * size, 18 * size, 14 * size, 7);
    this.block(
      0x39493e,
      x - 4 * size,
      y - 39 * size,
      2 * size,
      3 * size,
      2 * size,
      15,
    );
    this.block(
      0x39493e,
      x + 4 * size,
      y - 39 * size,
      2 * size,
      3 * size,
      2 * size,
      15,
    );
    for (let i = 0; i < 5; i++)
      this.block(
        color,
        x,
        y - (48 + i * 3) * size,
        (23 - i * 4) * size,
        3.2 * size,
        14 * size,
        8,
      );
  }
  dragon(x: number, y: number, size = 1, time = 0) {
    this.block(0x538775, x, y, 65 * size, 30 * size, 25 * size, 8);
    this.block(
      0x88ab8b,
      x - 29 * size,
      y - 12 * size,
      32 * size,
      27 * size,
      24 * size,
      12,
    );
    this.block(
      0xb8c58b,
      x - 43 * size,
      y - 2 * size,
      26 * size,
      15 * size,
      24 * size,
      15,
    );
    this.block(
      0xe4ce87,
      x - 31 * size,
      y - 17 * size,
      5 * size,
      4 * size,
      3 * size,
      26,
    );
    for (let i = 0; i < 5; i++) {
      this.block(
        0xc4bc87,
        x + i * 10 * size,
        y - 20 * size,
        7 * size,
        12 * size,
        8 * size,
        10,
      );
      this.block(
        0x538775,
        x + (36 + i * 7) * size,
        y + i * 3 * size,
        10 * size,
        10 * size,
        12 * size,
        6,
      );
    }
    this.block(
      0x426f60,
      x + 5 * size,
      y - 30 * size,
      (25 + Math.sin(time / 120) * 3) * size,
      30 * size,
      7 * size,
      5,
    );
  }
  render() {
    for (const bucket of this.buckets.values()) {
      if (bucket.matrices.length > bucket.mesh.instanceMatrix.count) {
        bucket.mesh.dispose();
        this.scene.remove(bucket.mesh);
        this.resources.instances.delete(bucket.mesh);
        bucket.mesh = new THREE.InstancedMesh(
          this.resources.cube,
          bucket.mat,
          2 ** Math.ceil(Math.log2(bucket.matrices.length)),
        );
        bucket.mesh.castShadow = true;
        bucket.mesh.receiveShadow = true;
        this.scene.add(bucket.mesh);
        this.resources.instances.add(bucket.mesh);
      }
      bucket.mesh.count = bucket.matrices.length;
      bucket.matrices.forEach((matrix, i) =>
        bucket.mesh.setMatrixAt(i, matrix),
      );
      bucket.mesh.instanceMatrix.needsUpdate = true;
      bucket.mesh.computeBoundingSphere();
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    const canvas = this.renderer.domElement,
      context = this.renderer.getContext();
    for (const entry of this.textTextures.values()) entry.texture.dispose();
    for (const sprite of this.sprites) sprite.material.dispose();
    this.light.shadow.dispose();
    this.resources.dispose();
    this.renderer.dispose();
    // React can immediately mount another renderer on this canvas in StrictMode.
    // Release the context only when the DOM canvas has actually been removed.
    queueMicrotask(() => {
      if (!canvas.isConnected)
        context.getExtension("WEBGL_lose_context")?.loseContext();
    });
  }
}
