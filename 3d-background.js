
// 3D Background with Three.js
// A clean, medical/tech inspired particle network

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // Scene setup
  const scene = new THREE.Scene();
  // Fog to blend particles into the background color (matches the gradient end)
  scene.fog = new THREE.FogExp2(0x0284c7, 0.002);

  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 50;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Particles
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 400; // Keep count reasonable for performance

  const posArray = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i++) {
    // Spread particles wide
    posArray[i] = (Math.random() - 0.5) * 150;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

  // Material: DNA/Medical tech look (Cyan/White glow)
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.7,
    color: 0xe0f2fe, // very light blue
    transparent: true,
    opacity: 0.8,
  });

  // Mesh
  const particlesMesh = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particlesMesh);

  // Connecting Lines (Plexus effect)
  // We'll use a LineSegments geometry which is faster than individual lines
  // However, updating it every frame is expensive in JS unless optimized.
  // For a "floating atoms" look, let's just use particles + subtle movement first to ensure 60fps.
  // We can add a secondary "wave" mesh for visual interest.

  // Secondary Mesh: Low poly wave
  const waveGeo = new THREE.PlaneGeometry(200, 200, 30, 30);
  const waveMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8, // light blue
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const wave = new THREE.Mesh(waveGeo, waveMat);
  wave.rotation.x = -Math.PI / 2 + 0.5;
  wave.position.y = -20;
  scene.add(wave);

  // Mouse interaction
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  const windowHalfX = window.innerWidth / 2;
  const windowHalfY = window.innerHeight / 2;

  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
  });

  // Animation Loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Gentle rotation of particles
    particlesMesh.rotation.y = elapsedTime * 0.05;
    particlesMesh.rotation.x = elapsedTime * 0.02;

    // Wave movement
    const positionAttribute = waveGeo.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
      // A simple sine wave effect
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i); // relative to plane, this is actually Z in world space before rotation
      // We disturb the Z (which becomes Y in world)
      const z = 2 * Math.sin(elapsedTime + x * 0.1) + 2 * Math.cos(elapsedTime + y * 0.1);
      positionAttribute.setZ(i, z);
    }
    positionAttribute.needsUpdate = true;

    // Mouse Parallax
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    particlesMesh.rotation.y += 0.05 * (targetX - particlesMesh.rotation.y);
    particlesMesh.rotation.x += 0.05 * (targetY - particlesMesh.rotation.x);

    renderer.render(scene, camera);
  }

  animate();

  // Resize handling
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
});
