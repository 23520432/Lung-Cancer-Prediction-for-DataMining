import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ==========================================
// KHỐI 1: TÍCH HỢP MÔ HÌNH 3D VỚI THREE.JS
// ==========================================
const container = document.getElementById("canvas-container");

const scene = new THREE.Scene();
scene.background = null; 

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 5000);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
mainLight.position.set(2, 6, 4);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x90b0ff, 0.6);
fillLight.position.set(-4, 2, -2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 1.0);
rimLight.position.set(0, 4, -5);
scene.add(rimLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

function getMedicalColor(spo2) {
    const color = new THREE.Color();
    const colorHigh = new THREE.Color(0xce2d2d); // Đỏ tươi (100%)
    const colorMid = new THREE.Color(0x872337);  // Đỏ sẫm (92%)
    const colorLow = new THREE.Color(0x361d32);  // Tím tái (70%)

    if (spo2 >= 92) {
        const t = (spo2 - 92) / (100 - 92);
        color.lerpColors(colorMid, colorHigh, t);
    } else {
        const t = (spo2 - 70) / (92 - 70);
        color.lerpColors(colorLow, colorMid, t);
    }
    return color;
}

let lungMeshes = [];

function updateColorBySpO2(spo2) {
    const targetColor = getMedicalColor(spo2);
    lungMeshes.forEach((m) => {
        m.material.color.copy(targetColor);
    });
}

const loader = new GLTFLoader();
loader.load(
    "./lungs_heart_reoriented_NIH3D.glb",
    (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        model.traverse((obj) => {
            if (obj.isMesh) {
                obj.geometry.computeVertexNormals();
                obj.material = new THREE.MeshPhysicalMaterial({
                    color: getMedicalColor(parseInt(document.getElementById("spo2").value)),
                    roughness: 0.5,
                    metalness: 0.0,
                    clearcoat: 0.7,
                    clearcoatRoughness: 0.1,
                    reflectivity: 0.5,
                    side: THREE.DoubleSide
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
    (err) => { console.error("Lỗi tải mô hình 3D:", err); }
);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

const resizeObserver = new ResizeObserver(() => {
    if (container.clientWidth > 0 && container.clientHeight > 0) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
});
resizeObserver.observe(container);

// ==========================================
// KHỐI 2: XỬ LÝ SỰ KIỆN GIAO DIỆN & FORM (DOM)
// ==========================================
const slider = document.getElementById("spo2");
const label = document.getElementById("spo2Val");

slider.addEventListener("input", () => {
    const v = parseInt(slider.value);
    label.textContent = v;
    
    if (v >= 95) label.style.color = "#6be0a2";
    else if (v >= 90) label.style.color = "#ffd460";
    else label.style.color = "#ff6b6b";

    updateColorBySpO2(v);
});

// Hàm hỗ trợ đổi số thành chữ (Có/Không, Nam/Nữ) để in ra tóm tắt cho dễ đọc
const yesNo = (val) => val === 1 ? "Có" : "Không";
const genderStr = (val) => val === 1 ? "Nam" : "Nữ";

document.getElementById('predictionForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // 1. Thu thập toàn bộ 29 trường dữ liệu thực tế từ giao diện HTML
    const patientData = {
        age: parseFloat(document.getElementById('age').value),
        gender: parseInt(document.getElementById('gender').value),
        education_years: parseFloat(document.getElementById('education_years').value),
        income_level: parseInt(document.getElementById('income_level').value),
        smoker: parseInt(document.getElementById('smoker').value),
        smoking_years: parseFloat(document.getElementById('smoking_years').value),
        cigarettes_per_day: parseFloat(document.getElementById('cigarettes_per_day').value),
        pack_years: parseFloat(document.getElementById('pack_years').value),
        passive_smoking: parseInt(document.getElementById('passive_smoking').value),
        air_pollution_index: parseFloat(document.getElementById('air_pollution_index').value),
        occupational_exposure: parseInt(document.getElementById('occupational_exposure').value),
        radon_exposure: parseInt(document.getElementById('radon_exposure').value),
        family_history_cancer: parseInt(document.getElementById('family_history_cancer').value),
        copd: parseInt(document.getElementById('copd').value),
        asthma: parseInt(document.getElementById('asthma').value),
        previous_tb: parseInt(document.getElementById('previous_tb').value),
        chronic_cough: parseInt(document.getElementById('chronic_cough').value),
        chest_pain: parseInt(document.getElementById('chest_pain').value),
        shortness_of_breath: parseInt(document.getElementById('shortness_of_breath').value),
        fatigue: parseInt(document.getElementById('fatigue').value),
        bmi: parseFloat(document.getElementById('bmi').value),
        oxygen_saturation: parseFloat(document.getElementById('spo2').value),
        fev1_x10: parseFloat(document.getElementById('fev1_x10').value),
        crp_level: parseFloat(document.getElementById('crp_level').value),
        xray_abnormal: parseInt(document.getElementById('xray_abnormal').value),
        exercise_hours_per_week: parseFloat(document.getElementById('exercise_hours_per_week').value),
        diet_quality: parseInt(document.getElementById('diet_quality').value),
        alcohol_units_per_week: parseFloat(document.getElementById('alcohol_units_per_week').value),
        healthcare_access: parseInt(document.getElementById('healthcare_access').value)
    };

    // 2. In toàn bộ 29 trường ra bảng Tóm tắt hồ sơ (Dùng CSS Grid để chia 2 cột cho gọn)
    const summaryDiv = document.getElementById('summaryInfo');
    summaryDiv.innerHTML = `
        <strong style="color: #0f4c81;">Tóm tắt 29 chỉ số bệnh nhân:</strong>
        <div style="font-size: 13px; margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div>- Tuổi: <b>${patientData.age}</b></div>
            <div>- Giới tính: <b>${genderStr(patientData.gender)}</b></div>
            <div>- Học vấn (năm): <b>${patientData.education_years}</b></div>
            <div>- Mức thu nhập: <b>${patientData.income_level}</b></div>
            <div>- BMI: <b>${patientData.bmi}</b></div>
            <div>- Đang hút thuốc: <b>${yesNo(patientData.smoker)}</b></div>
            <div>- Số năm hút: <b>${patientData.smoking_years}</b></div>
            <div>- Số điếu/ngày: <b>${patientData.cigarettes_per_day}</b></div>
            <div>- Pack Years: <b>${patientData.pack_years}</b></div>
            <div>- Hút thụ động: <b>${yesNo(patientData.passive_smoking)}</b></div>
            <div>- Ô nhiễm khí: <b>${patientData.air_pollution_index}</b></div>
            <div>- Rượu (ly/tuần): <b>${patientData.alcohol_units_per_week}</b></div>
            <div>- Thể dục (giờ): <b>${patientData.exercise_hours_per_week}</b></div>
            <div>- Ăn uống: <b>${patientData.diet_quality}</b></div>
            <div>- Phơi nhiễm nghề: <b>${yesNo(patientData.occupational_exposure)}</b></div>
            <div>- Phơi nhiễm Radon: <b>${yesNo(patientData.radon_exposure)}</b></div>
            <div>- Tiền sử g/đ UT: <b>${yesNo(patientData.family_history_cancer)}</b></div>
            <div>- Tiền sử Lao: <b>${yesNo(patientData.previous_tb)}</b></div>
            <div>- Hen suyễn: <b>${yesNo(patientData.asthma)}</b></div>
            <div>- COPD: <b>${yesNo(patientData.copd)}</b></div>
            <div>- Ho mãn tính: <b>${yesNo(patientData.chronic_cough)}</b></div>
            <div>- Đau ngực: <b>${yesNo(patientData.chest_pain)}</b></div>
            <div>- Khó thở: <b>${yesNo(patientData.shortness_of_breath)}</b></div>
            <div>- Mệt mỏi: <b>${yesNo(patientData.fatigue)}</b></div>
            <div>- FEV1 (x10): <b>${patientData.fev1_x10}</b></div>
            <div>- CRP (mg/L): <b>${patientData.crp_level}</b></div>
            <div>- X-Quang dị thường: <b>${yesNo(patientData.xray_abnormal)}</b></div>
            <div>- Tiếp cận y tế: <b>${patientData.healthcare_access}</b></div>
            <div style="color: #ce2d2d; font-weight: bold; grid-column: span 2;">
                - Nồng độ Oxy (SpO₂): ${patientData.oxygen_saturation}%
            </div>
        </div>
    `;

    // 3. Hiệu ứng chờ khi gọi API
    const resultBox = document.getElementById('predictionResult');
    resultBox.className = 'prediction-box';
    resultBox.innerHTML = '<h3>Đang phân tích dữ liệu AI...</h3>';

    // 4. Gửi dữ liệu bằng API Fetch sang Python Backend
    fetch('http://127.0.0.1:5000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            if (data.is_high_risk) {
                resultBox.className = 'prediction-box danger';
                resultBox.innerHTML = `
                    <h2>⚠️ CẢNH BÁO NGUY CƠ CAO (${data.risk_probability}%)</h2>
                    <p>Mô hình DES dự đoán bệnh nhân CÓ khả năng mắc Ung thư phổi.</p>
                `;
                
                // Kéo SpO2 xuống và làm phổi đổi màu thâm để cảnh báo
                if (parseInt(slider.value) > 85) {
                    slider.value = 85;
                    slider.dispatchEvent(new Event('input'));
                }
            } else {
                resultBox.className = 'prediction-box safe';
                resultBox.innerHTML = `
                    <h2>✅ NGUY CƠ THẤP (${data.risk_probability}%)</h2>
                    <p>AI dự đoán bệnh nhân KHÔNG có dấu hiệu Ung thư phổi.</p>
                `;
            }
        } else {
            resultBox.innerHTML = `<h3>Lỗi: ${data.message}</h3>`;
        }
    })
    .catch(error => {
        resultBox.innerHTML = `<h3>Lỗi kết nối máy chủ AI</h3>`;
        console.error("Lỗi:", error);
    });
});