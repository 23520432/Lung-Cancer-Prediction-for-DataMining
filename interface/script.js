import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Biến toàn cục để điều khiển trạng thái báo động
let isAlarmActive = false;

// ==========================================
// KHỐI 1: TÍCH HỢP MÔ HÌNH 3D VỚI THREE.JS
// ==========================================
const container = document.getElementById("canvas-container");

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.01,
  5000,
);
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
  const colorMid = new THREE.Color(0x872337); // Đỏ sẫm (92%)
  const colorLow = new THREE.Color(0x361d32); // Tím tái (70%)

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
          color: getMedicalColor(
            parseInt(document.getElementById("spo2").value),
          ),
          roughness: 0.5,
          metalness: 0.0,
          clearcoat: 0.7,
          clearcoatRoughness: 0.1,
          reflectivity: 0.5,
          side: THREE.DoubleSide,

          // MỚI THÊM: Thiết lập cấu hình phát sáng (Emissive) màu đỏ
          emissive: new THREE.Color(0xff0000),
          emissiveIntensity: 0.0, // Mặc định tắt (0.0)
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

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // MỚI THÊM: Xử lý hiệu ứng nhấp nháy đèn báo động đỏ
  if (isAlarmActive) {
    // Hàm Math.sin giúp tạo sóng nhấp nháy mượt mà theo thời gian thực
    const pulse = ((Math.sin(Date.now() * 0.005) + 1) / 2) * 0.8;
    lungMeshes.forEach((m) => (m.material.emissiveIntensity = pulse));
  } else {
    // Tắt hẳn phát sáng nếu an toàn
    lungMeshes.forEach((m) => (m.material.emissiveIntensity = 0.0));
  }

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

// BỘ LỌC 1: Lấy dữ liệu từ Form an toàn tuyệt đối (Chống NaN)
const safeFloat = (id, def) => {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? def : v;
};
const safeInt = (id, def) => {
  const v = parseInt(document.getElementById(id).value);
  return isNaN(v) ? def : v;
};

slider.addEventListener("input", () => {
  const v = parseInt(slider.value);
  label.textContent = v;
  if (v >= 95) label.style.color = "#6be0a2";
  else if (v >= 90) label.style.color = "#ffd460";
  else label.style.color = "#ff6b6b";
  updateColorBySpO2(v);
});

const yesNo = (val) => (val === 1 ? "Có" : "Không");
const genderStr = (val) => (val === 1 ? "Nam" : "Nữ");

document
  .getElementById("predictionForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    isAlarmActive = false;

    // Dùng hàm bọc thép safeFloat và safeInt để không bao giờ bị dính NaN
    // ÉP KHUÔN THỨ TỰ CỘT SỐ 1
    const patientData = {
      age: safeFloat("age", 55),
      gender: safeInt("gender", 1),
      education_years: safeFloat("education_years", 12),
      income_level: safeInt("income_level", 2),
      smoker: safeInt("smoker", 1),
      smoking_years: safeFloat("smoking_years", 0),
      cigarettes_per_day: safeFloat("cigarettes_per_day", 0),
      pack_years: safeFloat("pack_years", 0),
      passive_smoking: safeInt("passive_smoking", 0),
      air_pollution_index: safeFloat("air_pollution_index", 50),
      occupational_exposure: safeInt("occupational_exposure", 0),
      radon_exposure: safeInt("radon_exposure", 0),
      family_history_cancer: safeInt("family_history_cancer", 0),
      copd: safeInt("copd", 0),
      asthma: safeInt("asthma", 0),
      previous_tb: safeInt("previous_tb", 0),
      chronic_cough: safeInt("chronic_cough", 0),
      chest_pain: safeInt("chest_pain", 0),
      shortness_of_breath: safeInt("shortness_of_breath", 0),
      fatigue: safeInt("fatigue", 0),
      bmi: safeFloat("bmi", 22.5),
      oxygen_saturation: safeFloat("spo2", 97),
      fev1_x10: safeFloat("fev1_x10", 25),
      crp_level: safeFloat("crp_level", 3.0),
      xray_abnormal: safeInt("xray_abnormal", 0),
      exercise_hours_per_week: safeFloat("exercise_hours_per_week", 2),
      diet_quality: safeInt("diet_quality", 2),
      alcohol_units_per_week: safeFloat("alcohol_units_per_week", 0),
      healthcare_access: safeInt("healthcare_access", 2),
    };

    const summaryDiv = document.getElementById("summaryInfo");
    summaryDiv.innerHTML = `
        <strong style="color: #0f4c81; font-size: 16px;">Tóm tắt 29 chỉ số bệnh nhân:</strong>
        <div style="font-size: 13px; margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; line-height: 1.6;">
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
            <div style="color: #c62828; font-weight: bold; grid-column: span 2; font-size: 15px; border-top: 1px solid #ccc; padding-top: 10px;">
                - Nồng độ Oxy (SpO₂): ${patientData.oxygen_saturation}%
            </div>
        </div>
    `;

    const resultBox = document.getElementById("predictionResult");
    resultBox.className = "prediction-box";
    resultBox.innerHTML = "<h3>Đang phân tích dữ liệu AI...</h3>";

    fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          if (data.risk_level === "HIGH") {
            resultBox.className = "prediction-box danger";
            resultBox.innerHTML = `<h2>🔴 NGUY CƠ CAO (${data.risk_probability}%)</h2><p>Phát hiện nhiều chỉ số bất thường. Đề xuất sinh thiết/can thiệp y tế khẩn cấp.</p>`;
            isAlarmActive = true;
          } else if (data.risk_level === "WARNING") {
            resultBox.className = "prediction-box warning";
            resultBox.innerHTML = `<h2>🟠 CẢNH BÁO tiềm ẩn (${data.risk_probability}%)</h2><p>Bệnh nhân nằm trong vùng nguy cơ. Cần chỉ định chụp X-Quang/CT để kiểm tra thêm.</p>`;
            isAlarmActive = false; // Mức cam chưa cần nháy đèn 3D
          } else {
            resultBox.className = "prediction-box safe";
            resultBox.innerHTML = `<h2>🟢 NGUY CƠ THẤP (${data.risk_probability}%)</h2><p>Chưa phát hiện dấu hiệu đặc trưng của Ung thư phổi.</p>`;
            isAlarmActive = false;
          }
        } else {
          resultBox.innerHTML = `<h3>Lỗi Backend: ${data.message}</h3>`;
        }
      })
      .catch((error) => {
        resultBox.innerHTML = `<h3>Lỗi kết nối máy chủ AI</h3>`;
        console.error("Lỗi:", error);
      });
  });

// ==========================================
// KHỐI 3 & 4: XỬ LÝ CSV, LỌC, SẮP XẾP THEO CỘT
// ==========================================
let masterData = [];
let currentDisplayData = [];
let currentSortCol = "";
let sortAscending = true;

const cleanFloat = (val, def) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? def : parsed;
};
const cleanInt = (val, def) => {
  const parsed = Math.round(parseFloat(val));
  return isNaN(parsed) ? def : parsed;
};

// TẢI FILE CSV
document.getElementById("btnProcessCSV").addEventListener("click", function () {
  const fileInput = document.getElementById("csvFileInput");
  if (!fileInput.files.length) {
    alert("Vui lòng chọn file CSV!");
    return;
  }

  const progressText = document.getElementById("progressText");
  progressText.innerText = "Đang khởi tạo công cụ đọc CSV...";

  Papa.parse(fileInput.files[0], {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: async function (results) {
      const data = results.data;
      masterData = [];
      const limit = Math.min(data.length, 200);
      document.getElementById("toolbar").style.display = "flex";

      for (let i = 0; i < limit; i++) {
        const row = data[i];
        progressText.innerText = `Đang phân tích ca bệnh ${i + 1} / ${limit}...`;

        const patientData = {
          age: cleanFloat(row.age || row.Age, 55),
          gender: cleanInt(row.gender || row.Gender, 1),
          education_years: cleanFloat(row.education_years, 12),
          income_level: cleanInt(row.income_level, 2),
          smoker: cleanInt(row.smoker || row.Smoker, 1),
          smoking_years: cleanFloat(row.smoking_years, 0),
          cigarettes_per_day: cleanFloat(row.cigarettes_per_day, 0),
          pack_years: cleanFloat(row.pack_years || row.Pack_Years, 0),
          passive_smoking: cleanInt(row.passive_smoking, 0),
          air_pollution_index: cleanFloat(row.air_pollution_index, 50),
          occupational_exposure: cleanInt(row.occupational_exposure, 0),
          radon_exposure: cleanInt(row.radon_exposure, 0),
          family_history_cancer: cleanInt(row.family_history_cancer, 0),
          copd: cleanInt(row.copd || row.COPD, 0),
          asthma: cleanInt(row.asthma || row.Asthma, 0),
          previous_tb: cleanInt(row.previous_tb, 0),
          chronic_cough: cleanInt(row.chronic_cough, 0),
          chest_pain: cleanInt(row.chest_pain, 0),
          shortness_of_breath: cleanInt(row.shortness_of_breath, 0),
          fatigue: cleanInt(row.fatigue, 0),
          bmi: cleanFloat(row.bmi || row.BMI, 22.5),
          oxygen_saturation: cleanFloat(row.oxygen_saturation || row.SpO2, 97),
          fev1_x10: cleanFloat(row.fev1_x10, 25),
          crp_level: cleanFloat(row.crp_level, 3.0),
          xray_abnormal: cleanInt(row.xray_abnormal, 0),
          exercise_hours_per_week: cleanFloat(row.exercise_hours_per_week, 2),
          diet_quality: cleanInt(row.diet_quality || row.Diet_Quality, 2),
          alcohol_units_per_week: cleanFloat(row.alcohol_units_per_week, 0),
          healthcare_access: cleanInt(row.healthcare_access, 2),
        };

        try {
          const response = await fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patientData),
          });
          const result = await response.json();

          masterData.push({
            originalId: i + 1,
            data: patientData,
            prediction: result,
          });
        } catch (err) {
          console.error("Lỗi dòng " + i, err);
        }
      }
      progressText.innerText = "Đã hoàn tất phân tích!";
      currentDisplayData = [...masterData];
      currentSortCol = "";
      document
        .querySelectorAll(".sort-icon")
        .forEach((icon) => (icon.innerHTML = "↕"));
      renderTable(currentDisplayData);
    },
  });
});

// VẼ BẢNG
function renderTable(dataArray) {
  const tbody = document.getElementById("patientsTableBody");
  let tableHTML = "";
  if (dataArray.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center;">Không tìm thấy kết quả phù hợp.</td></tr>';
    return;
  }
  dataArray.forEach((patient) => {
    const d = patient.data;
    const res = patient.prediction;
    let riskText = "";
    if (res.risk_level === "HIGH") {
      riskText = `<span style="color: #c62828; font-weight: bold;">Nguy cơ Cao (${res.risk_probability}%)</span>`;
    } else if (res.risk_level === "WARNING") {
      riskText = `<span style="color: #f57c00; font-weight: bold;">Cảnh báo (${res.risk_probability}%)</span>`;
    } else {
      riskText = `<span style="color: #2e7d32; font-weight: bold;">Nguy cơ Thấp (${res.risk_probability}%)</span>`;
    }

    tableHTML += `
            <tr onclick="loadPatientToForm(${patient.originalId - 1})">
                <td><b>BN-${patient.originalId}</b></td>
                <td>${d.age}</td>
                <td>${d.gender === 1 ? "Nam" : "Nữ"}</td>
                <td>${d.pack_years}</td>
                <td>${d.chronic_cough === 1 ? "Có" : "Không"}</td>
                <td>${d.oxygen_saturation}%</td>
                <td>${riskText}</td>
                <td><button style="padding: 5px 12px; cursor: pointer; background: #0f4c81; color: white; border: none; border-radius: 4px;">Soi 3D</button></td>
            </tr>
        `;
  });
  tbody.innerHTML = tableHTML;
}

// BỘ LỌC NGUY CƠ
document.getElementById("filterRisk").addEventListener("change", () => {
  const filterValue = document.getElementById("filterRisk").value;
  currentDisplayData = masterData.filter((p) => {
    if (filterValue !== "ALL" && p.prediction.risk_level !== filterValue)
      return false;
    return true;
  });
  if (currentSortCol) sortData(currentSortCol, sortAscending);
  else renderTable(currentDisplayData);
});

// SẮP XẾP CLICK THEO CỘT
document.querySelectorAll("th.sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const col = th.getAttribute("data-col");
    if (currentSortCol === col) sortAscending = !sortAscending;
    else {
      currentSortCol = col;
      sortAscending = true;
    }

    document
      .querySelectorAll(".sort-icon")
      .forEach((icon) => (icon.innerHTML = "↕"));
    th.querySelector(".sort-icon").innerHTML = sortAscending ? "↑" : "↓";
    sortData(col, sortAscending);
  });
});

function sortData(col, isAsc) {
  currentDisplayData.sort((a, b) => {
    let valA, valB;
    switch (col) {
      case "id":
        valA = a.originalId;
        valB = b.originalId;
        break;
      case "age":
        valA = a.data.age;
        valB = b.data.age;
        break;
      case "gender":
        valA = a.data.gender;
        valB = b.data.gender;
        break;
      case "pack_years":
        valA = a.data.pack_years;
        valB = b.data.pack_years;
        break;
      case "chronic_cough":
        valA = a.data.chronic_cough;
        valB = b.data.chronic_cough;
        break;
      case "spo2":
        valA = a.data.oxygen_saturation;
        valB = b.data.oxygen_saturation;
        break;
      case "risk":
        valA = a.prediction.risk_probability;
        valB = b.prediction.risk_probability;
        break;
      default:
        return 0;
    }
    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });
  renderTable(currentDisplayData);
}

// CLICK VÀO BỆNH NHÂN TRONG BẢNG
window.loadPatientToForm = function (masterIndex) {
  const patient = masterData[masterIndex];
  if (!patient) return;

  const d = patient.data;
  const res = patient.prediction;

  // 1. Tự động điền Form
  document.getElementById("age").value = d.age;
  document.getElementById("gender").value = d.gender;
  document.getElementById("education_years").value = d.education_years;
  document.getElementById("income_level").value = d.income_level;
  document.getElementById("smoker").value = d.smoker;
  document.getElementById("smoking_years").value = d.smoking_years;
  document.getElementById("cigarettes_per_day").value = d.cigarettes_per_day;
  document.getElementById("pack_years").value = d.pack_years;
  document.getElementById("passive_smoking").value = d.passive_smoking;
  document.getElementById("air_pollution_index").value = d.air_pollution_index;
  document.getElementById("occupational_exposure").value =
    d.occupational_exposure;
  document.getElementById("radon_exposure").value = d.radon_exposure;
  document.getElementById("family_history_cancer").value =
    d.family_history_cancer;
  document.getElementById("copd").value = d.copd;
  document.getElementById("asthma").value = d.asthma;
  document.getElementById("previous_tb").value = d.previous_tb;
  document.getElementById("chronic_cough").value = d.chronic_cough;
  document.getElementById("chest_pain").value = d.chest_pain;
  document.getElementById("shortness_of_breath").value = d.shortness_of_breath;
  document.getElementById("fatigue").value = d.fatigue;
  document.getElementById("bmi").value = d.bmi;
  document.getElementById("fev1_x10").value = d.fev1_x10;
  document.getElementById("crp_level").value = d.crp_level;
  document.getElementById("xray_abnormal").value = d.xray_abnormal;
  document.getElementById("exercise_hours_per_week").value =
    d.exercise_hours_per_week;
  document.getElementById("diet_quality").value = d.diet_quality;
  document.getElementById("alcohol_units_per_week").value =
    d.alcohol_units_per_week;
  document.getElementById("healthcare_access").value = d.healthcare_access;

  // Xử lý thanh trượt SpO2
  document.getElementById("spo2").value = d.oxygen_saturation;
  document.getElementById("spo2Val").textContent = d.oxygen_saturation;
  document.getElementById("spo2").dispatchEvent(new Event("input"));

  // 2. Chuyển Tab
  switchTab("tab-detail");

  // 3. Vẽ bảng tóm tắt
  document.getElementById("summaryInfo").innerHTML = `
        <strong style="color: #0f4c81; font-size: 16px;">Tóm tắt 29 chỉ số bệnh nhân (BN-${patient.originalId}):</strong>
        <div style="font-size: 13px; margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; line-height: 1.6;">
            <div>- Tuổi: <b>${d.age}</b></div><div>- Giới tính: <b>${d.gender === 1 ? "Nam" : "Nữ"}</b></div>
            <div>- Học vấn: <b>${d.education_years}</b></div><div>- Thu nhập: <b>${d.income_level}</b></div>
            <div>- BMI: <b>${d.bmi}</b></div><div>- Hút thuốc: <b>${d.smoker === 1 ? "Có" : "Không"}</b></div>
            <div>- Năm hút: <b>${d.smoking_years}</b></div><div>- Điếu/ngày: <b>${d.cigarettes_per_day}</b></div>
            <div>- Pack Years: <b>${d.pack_years}</b></div><div>- Hút thụ động: <b>${d.passive_smoking === 1 ? "Có" : "Không"}</b></div>
            <div>- Ô nhiễm khí: <b>${d.air_pollution_index}</b></div><div>- Rượu/tuần: <b>${d.alcohol_units_per_week}</b></div>
            <div>- Thể dục: <b>${d.exercise_hours_per_week}</b></div><div>- Ăn uống: <b>${d.diet_quality}</b></div>
            <div>- Phơi nhiễm nghề: <b>${d.occupational_exposure === 1 ? "Có" : "Không"}</b></div><div>- Radon: <b>${d.radon_exposure === 1 ? "Có" : "Không"}</b></div>
            <div>- G/đ UT: <b>${d.family_history_cancer === 1 ? "Có" : "Không"}</b></div><div>- Tiền sử Lao: <b>${d.previous_tb === 1 ? "Có" : "Không"}</b></div>
            <div>- Hen suyễn: <b>${d.asthma === 1 ? "Có" : "Không"}</b></div><div>- COPD: <b>${d.copd === 1 ? "Có" : "Không"}</b></div>
            <div>- Ho mãn tính: <b>${d.chronic_cough === 1 ? "Có" : "Không"}</b></div><div>- Đau ngực: <b>${d.chest_pain === 1 ? "Có" : "Không"}</b></div>
            <div>- Khó thở: <b>${d.shortness_of_breath === 1 ? "Có" : "Không"}</b></div><div>- Mệt mỏi: <b>${d.fatigue === 1 ? "Có" : "Không"}</b></div>
            <div>- FEV1 (x10): <b>${d.fev1_x10}</b></div><div>- CRP: <b>${d.crp_level}</b></div>
            <div>- X-Quang dị thường: <b>${d.xray_abnormal === 1 ? "Có" : "Không"}</b></div><div>- Y tế: <b>${d.healthcare_access}</b></div>
            <div style="color: #c62828; font-weight: bold; grid-column: span 2; font-size: 15px; border-top: 1px solid #ccc; padding-top: 10px;">- Nồng độ Oxy (SpO₂): ${d.oxygen_saturation}%</div>
        </div>
    `;

  // ==========================================
  // 4. MỚI CẬP NHẬT: XỬ LÝ HỘP KẾT QUẢ 3 MỨC ĐỘ
  // ==========================================
  const resultBox = document.getElementById("predictionResult");
  if (res.risk_level === "HIGH") {
    resultBox.className = "prediction-box danger";
    resultBox.innerHTML = `<h2>🔴 NGUY CƠ CAO (${res.risk_probability}%)</h2><p>Phát hiện nhiều chỉ số bất thường. Đề xuất sinh thiết/can thiệp y tế khẩn cấp.</p>`;
    isAlarmActive = true; // Bật nháy đỏ 3D
  } else if (res.risk_level === "WARNING") {
    resultBox.className = "prediction-box warning";
    resultBox.innerHTML = `<h2>🟠 CẢNH BÁO tiềm ẩn (${res.risk_probability}%)</h2><p>Bệnh nhân nằm trong vùng nguy cơ. Cần chỉ định chụp X-Quang/CT để kiểm tra thêm.</p>`;
    isAlarmActive = false; // Mức cam chưa cần nháy đèn
  } else {
    resultBox.className = "prediction-box safe";
    resultBox.innerHTML = `<h2>🟢 NGUY CƠ THẤP (${res.risk_probability}%)</h2><p>Chưa phát hiện dấu hiệu đặc trưng của Ung thư phổi.</p>`;
    isAlarmActive = false; // Tắt nháy đèn
  }
};
