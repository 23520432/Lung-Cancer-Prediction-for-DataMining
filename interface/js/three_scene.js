// three_scene.js
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let scene, camera, renderer, controls;
let lungMeshes = [];
let isAlarmActive = false; // Trạng thái báo động nội bộ

// Vòng lặp Render liên tục
function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();

  // Xử lý hiệu ứng nhấp nháy đèn báo động đỏ
  if (isAlarmActive) {
    const pulse = ((Math.sin(Date.now() * 0.005) + 1) / 2) * 0.8;
    lungMeshes.forEach((m) => (m.material.emissiveIntensity = pulse));
  } else {
    lungMeshes.forEach((m) => (m.material.emissiveIntensity = 0.0));
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ==========================================
// CÁC HÀM EXPORT CHO BÊN NGOÀI SỬ DỤNG
// ==========================================

export function init3DModel() {
  const container = document.getElementById("canvas-container");
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.01,
    5000,
  );
  camera.position.set(0, 1, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  container.appendChild(renderer.domElement);

  // Ánh sáng
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
  mainLight.position.set(2, 6, 4);
  scene.add(mainLight);
  const fillLight = new THREE.DirectionalLight(0x90b0ff, 0.6);
  fillLight.position.set(-4, 2, -2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 1.0);
  rimLight.position.set(0, 4, -5);
  scene.add(rimLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Tải mô hình
  const loader = new GLTFLoader();
  loader.load(
    "./assets/lungs_heart_reoriented_NIH3D.glb",
    (gltf) => {
      const model = gltf.scene;
      scene.add(model);

      model.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.computeVertexNormals();
          const initialSpo2 = document.getElementById("spo2")
            ? parseInt(document.getElementById("spo2").value)
            : 97;

          obj.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xce2d2d),
            roughness: 0.5,
            metalness: 0.0,
            clearcoat: 0.7,
            clearcoatRoughness: 0.1,
            reflectivity: 0.5,
            side: THREE.DoubleSide,
            emissive: new THREE.Color(0xff0000),
            emissiveIntensity: 0.0,
          });
          lungMeshes.push(obj);
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      model.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.z = maxDim * 1.5;
      camera.position.y = maxDim * 0.15;
      controls.target.set(0, 0, 0);
      controls.update();
    },
    undefined,
    (err) => {
      console.error("Lỗi tải mô hình 3D:", err);
    },
  );

  // Xử lý khi co giãn màn hình web (Đã fix lỗi Fullscreen)
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        // cấm Three.js tự động chèn kích thước vào CSS inline của Canvas
        renderer.setSize(width, height, false);
      }
    }
  });
  resizeObserver.observe(container);

  animate();
}

// ==========================================
// CẬP NHẬT ĐỒ HỌA THEO 2 TRỤC: MÀU SẮC (Oxy) & CHẤT LIỆU (Khói thuốc)
// ==========================================
export function updateLungVisuals(spo2, packYears = 0) {
  // 1. TRỤC SpO2: CHỈ QUẢN LÝ MÀU MÁU (Sắc độ Đỏ -> Tím xanh)
  const baseColor = new THREE.Color();
  const colorRich = new THREE.Color(0xce2d2d); // Đỏ tươi (Máu giàu Oxy)
  const colorPoor = new THREE.Color(0x4a2b66); // Tím xanh (Máu thiếu Oxy - Cyanosis)

  // Tính tỷ lệ SpO2 (Từ 70 đến 97)
  const spo2Factor = Math.max(0, Math.min(1, (spo2 - 70) / (97 - 70)));
  baseColor.lerpColors(colorPoor, colorRich, spo2Factor);

  // 2. TRỤC PACK YEARS: QUẢN LÝ MÀU NHỰA THUỐC (Nâu xỉn)
  const tarColor = new THREE.Color(0x2d241e); // Nâu đen ám khói
  const tarFactor = Math.min(packYears / 60, 0.85); // Kịch trần ở 60 năm thâm niên

  // Trộn màu máu với màu nhựa thuốc
  const finalColor = baseColor.clone().lerp(tarColor, tarFactor);

  lungMeshes.forEach((m) => {
    // Áp dụng màu sắc
    m.material.color.copy(finalColor);

    // ==========================================
    // SỰ KHÁC BIỆT LỚN NHẤT: VẬT LÝ BỀ MẶT
    // ==========================================
    // Phổi khỏe (tar=0): Ướt át, bóng bẩy (Clearcoat cao, Roughness thấp)
    // Phổi hút thuốc (tar>0): Khô khốc, sần sùi (Clearcoat thấp, Roughness cao)

    m.material.roughness = 0.4 + tarFactor * 0.5; // Tăng độ nhám
    m.material.clearcoat = 0.8 - tarFactor * 0.8; // Giảm độ bóng bẩy
    m.material.clearcoatRoughness = 0.1 + tarFactor * 0.5; // Lớp màng mờ đục đi
  });
}

export function setAlarmStatus(isActive) {
  isAlarmActive = isActive;
}
