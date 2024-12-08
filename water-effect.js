const THREE = window.THREE;
const { Effect, EffectComposer, RenderPass, EffectPass } = POSTPROCESSING;

class WaterTexture {
  constructor(options = { debug: false }) {
    this.size = 64;
    this.radius = this.size * 0.1;
    this.width = this.height = this.size;
    this.points = [];
    this.maxAge = 64;
    this.last = null;

    if (options.debug) {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.radius = this.width * 0.05;
    }

    this.initTexture();

    if (options.debug) document.body.append(this.canvas);
  }

  initTexture() {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "WaterTexture";
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");
    this.clear();

    this.texture = new THREE.Texture(this.canvas);
  }

  clear() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addPoint(point) {
    let force = 0;
    let vx = 0;
    let vy = 0;

    if (this.last) {
      const relativeX = point.x - this.last.x;
      const relativeY = point.y - this.last.y;
      const distanceSquared = relativeX * relativeX + relativeY * relativeY;
      const distance = Math.sqrt(distanceSquared);

      vx = relativeX / distance;
      vy = relativeY / distance;

      force = Math.min(distanceSquared * 10000, 1.0);
    }

    this.last = { x: point.x, y: point.y };

    this.points.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  update() {
    this.clear();
    const agePart = 1.0 / this.maxAge;

    this.points.forEach((point, i) => {
      const slowAsOlder = 1.0 - point.age / this.maxAge;
      const force = point.force * agePart * slowAsOlder;

      point.x += point.vx * force;
      point.y += point.vy * force;

      point.age += 1;

      if (point.age > this.maxAge) {
        this.points.splice(i, 1);
      }
    });

    this.points.forEach((point) => {
      this.drawPoint(point);
    });

    this.texture.needsUpdate = true;
  }

  drawPoint(point) {
    const pos = {
      x: point.x * this.width,
      y: point.y * this.height,
    };

    const radius = this.radius;
    const ctx = this.ctx;

    let intensity = 1.0 - point.age / this.maxAge;

    let color = `255, 255, 255`;

    let offset = this.width * 5.0;
    ctx.shadowOffsetX = offset;
    ctx.shadowOffsetY = offset;
    ctx.shadowBlur = radius * 1.0;
    ctx.shadowColor = `rgba(${color}, ${0.2 * intensity})`;

    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 0, 0, 1)";
    ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class WaterEffect extends Effect {
  constructor(texture) {
    super("WaterEffect", fragment, {
      uniforms: new Map([["uTexture", new THREE.Uniform(texture)]]),
    });
  }
}

const fragment = `
uniform sampler2D uTexture;

void mainUv(inout vec2 uv) {
    vec4 tex = texture2D(uTexture, uv);
    
    float vx = -(tex.r * 2.0 - 1.0);
    float vy = -(tex.g * 2.0 - 1.0);

    float intensity = tex.b;

    float maxAmplitude = 0.2;

    uv.x += vx * intensity * maxAmplitude;
    uv.y += vy * intensity * maxAmplitude;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = inputColor;
}
`;

document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".ref_item-img");

  items.forEach((item) => {
    const img = item.querySelector(".ref-main_img"); // L'image principale
    const imgSrc = img.src; // Obtenir le chemin de l'image
    const width = item.offsetWidth;
    const height = item.offsetHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    item.replaceChild(canvas, img);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      1000
    );
    camera.position.z = 10;

    const texture = new THREE.TextureLoader().load(imgSrc);

    const geometry = new THREE.PlaneBufferGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    const waterTexture = new WaterTexture({ debug: false });

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const waterEffect = new WaterEffect(waterTexture.texture);
    const effectPass = new EffectPass(camera, waterEffect);

    renderPass.renderToScreen = false;
    effectPass.renderToScreen = true;

    composer.addPass(renderPass);
    composer.addPass(effectPass);

    canvas.addEventListener("mousemove", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        waterTexture.addPoint({ x, y });
      }
    });

    const animate = () => {
      waterTexture.update();
      composer.render();
      requestAnimationFrame(animate);
    };

    animate();
  });
});
