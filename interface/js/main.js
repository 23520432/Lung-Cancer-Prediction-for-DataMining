import {
  init3DModel,
  updateLungVisuals,
  setAlarmStatus,
} from "./three_scene.js";
import {
  cleanFloat,
  cleanInt,
  safeFloat,
  safeInt,
  sortPatientArray,
} from "./data_utils.js";
import { fetchPrediction } from "./api_service.js";

let masterData = [];
let currentDisplayData = [];
let currentSortCol = "";
let sortAscending = true;

// 1. KHỞI TẠO HỆ THỐNG
init3DModel();

// Hàm chuyển Tab (gắn vào window để gọi từ HTML)
window.switchTab = function (tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  if (tabId === "tab-list")
    document.getElementById("btn-tab-list").classList.add("active");
  else document.getElementById("btn-tab-detail").classList.add("active");
};

// 2. XỬ LÝ THANH TRƯỢT SPO2
const slider = document.getElementById("spo2");
const label = document.getElementById("spo2Val");
slider.addEventListener("input", () => {
  const v = parseInt(slider.value);
  label.textContent = v;
  if (v >= 95) label.style.color = "#6be0a2";
  else if (v >= 90) label.style.color = "#ffd460";
  else label.style.color = "#ff6b6b";
  updateLungVisuals(v, safeFloat("pack_years", 0));
});

// XỬ LÝ LẮNG NGHE SỰ KIỆN NHẬP PACK YEARS
document.getElementById("pack_years").addEventListener("input", () => {
  const py = safeFloat("pack_years", 0);
  const currentSpO2 = safeFloat("spo2", 97);
  updateLungVisuals(currentSpO2, py);
});

// 3. XỬ LÝ UPLOAD CSV
document.getElementById("btnProcessCSV").addEventListener("click", function () {
  const fileInput = document.getElementById("csvFileInput");
  if (!fileInput.files.length) {
    alert("Vui lòng chọn file CSV!");
    return;
  }

  const progressText = document.getElementById("progressText");
  progressText.innerText = "Đang phân tích dữ liệu...";

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
        const patientData = {
          age: cleanFloat(row.age || row.Age, 55),
          gender: cleanInt(row.gender || row.Gender, 0),
          education_years: cleanFloat(row.education_years, 11),
          income_level: cleanInt(row.income_level, 3),
          smoker: cleanInt(row.smoker || row.Smoker, 1),
          smoking_years: cleanFloat(row.smoking_years, 0),
          cigarettes_per_day: cleanFloat(row.cigarettes_per_day, 0),
          pack_years: cleanFloat(row.pack_years || row.Pack_Years, 0),
          passive_smoking: cleanInt(row.passive_smoking, 0),
          air_pollution_index: cleanFloat(row.air_pollution_index, 64),
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
          bmi: cleanFloat(row.bmi || row.BMI, 24.0),
          oxygen_saturation: cleanFloat(row.oxygen_saturation || row.SpO2, 97),
          fev1_x10: cleanFloat(row.fev1_x10, 33),
          crp_level: cleanFloat(row.crp_level, 3.0),
          xray_abnormal: cleanInt(row.xray_abnormal, 0),
          exercise_hours_per_week: cleanFloat(row.exercise_hours_per_week, 2),
          diet_quality: cleanInt(row.diet_quality || row.Diet_Quality, 3),
          alcohol_units_per_week: cleanFloat(row.alcohol_units_per_week, 6),
          healthcare_access: cleanInt(row.healthcare_access, 3),
        };

        try {
          const result = await fetchPrediction(patientData);
          masterData.push({
            originalId: i + 1,
            data: patientData,
            prediction: result,
          });
        } catch (err) {}
      }
      progressText.innerText = "Hoàn tất!";
      currentDisplayData = [...masterData];
      renderTable(currentDisplayData);
    },
  });
});

// 4. VẼ BẢNG & SẮP XẾP
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
    if (res.risk_level === "HIGH")
      riskText = `<span style="color: #c62828; font-weight: bold;">Nguy cơ Cao (${res.risk_probability}%)</span>`;
    else if (res.risk_level === "WARNING")
      riskText = `<span style="color: #f57c00; font-weight: bold;">Cảnh báo (${res.risk_probability}%)</span>`;
    else
      riskText = `<span style="color: #2e7d32; font-weight: bold;">Nguy cơ Thấp (${res.risk_probability}%)</span>`;

    tableHTML += `
            <tr onclick="loadPatientToForm(${patient.originalId - 1})">
                <td><b>BN-${patient.originalId}</b></td><td>${d.age}</td><td>${d.gender === 1 ? "Nam" : "Nữ"}</td>
                <td>${d.pack_years}</td><td>${d.chronic_cough === 1 ? "Có" : "Không"}</td><td>${d.oxygen_saturation}%</td>
                <td>${riskText}</td><td><button style="padding: 5px 12px; cursor: pointer; background: #0f4c81; color: white; border: none; border-radius: 4px;">Soi 3D</button></td>
            </tr>`;
  });
  tbody.innerHTML = tableHTML;
}

document.getElementById("filterRisk").addEventListener("change", () => {
  const val = document.getElementById("filterRisk").value;
  currentDisplayData = masterData.filter(
    (p) => val === "ALL" || p.prediction.risk_level === val,
  );
  if (currentSortCol)
    currentDisplayData = sortPatientArray(
      currentDisplayData,
      currentSortCol,
      sortAscending,
    );
  renderTable(currentDisplayData);
});

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
    currentDisplayData = sortPatientArray(
      currentDisplayData,
      currentSortCol,
      sortAscending,
    );
    renderTable(currentDisplayData);
  });
});

// 5. CHUYỂN DỮ LIỆU SANG FORM
window.loadPatientToForm = function (index) {
  const patient = masterData[index];
  if (!patient) return;
  const d = patient.data;
  const res = patient.prediction;

  [
    "age",
    "gender",
    "education_years",
    "income_level",
    "smoker",
    "smoking_years",
    "cigarettes_per_day",
    "pack_years",
    "passive_smoking",
    "air_pollution_index",
    "occupational_exposure",
    "radon_exposure",
    "family_history_cancer",
    "copd",
    "asthma",
    "previous_tb",
    "chronic_cough",
    "chest_pain",
    "shortness_of_breath",
    "fatigue",
    "bmi",
    "fev1_x10",
    "crp_level",
    "xray_abnormal",
    "exercise_hours_per_week",
    "diet_quality",
    "alcohol_units_per_week",
    "healthcare_access",
  ].forEach((key) => {
    document.getElementById(key).value = d[key];
  });

  document.getElementById("spo2").value = d.oxygen_saturation;
  document.getElementById("spo2").dispatchEvent(new Event("input"));
  // Đồng bộ hiển thị 3D cho ca bệnh được chọn
  updateLungVisuals(d.oxygen_saturation, d.pack_years);
  window.switchTab("tab-detail");
  updateResultUI(d, res, patient.originalId);
};

// 6. XỬ LÝ FORM NHẬP TAY
document
  .getElementById("predictionForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    setAlarmStatus(false);

    const patientData = {
      age: safeFloat("age", 55),
      gender: safeInt("gender", 1),
      education_years: safeFloat("education_years", 11),
      income_level: safeInt("income_level", 3),
      smoker: safeInt("smoker", 1),
      smoking_years: safeFloat("smoking_years", 0),
      cigarettes_per_day: safeFloat("cigarettes_per_day", 0),
      pack_years: safeFloat("pack_years", 0),
      passive_smoking: safeInt("passive_smoking", 0),
      air_pollution_index: safeFloat("air_pollution_index", 64),
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
      bmi: safeFloat("bmi", 24.0),
      oxygen_saturation: safeFloat("spo2", 97),
      fev1_x10: safeFloat("fev1_x10", 33),
      crp_level: safeFloat("crp_level", 3.0),
      xray_abnormal: safeInt("xray_abnormal", 0),
      exercise_hours_per_week: safeFloat("exercise_hours_per_week", 2),
      diet_quality: safeInt("diet_quality", 3),
      alcohol_units_per_week: safeFloat("alcohol_units_per_week", 0),
      healthcare_access: safeInt("healthcare_access", 3),
    };

    try {
      const result = await fetchPrediction(patientData);
      if (result.status === "success") {
        updateResultUI(patientData, result, "Nhập tay");
      }
    } catch (err) {
      document.getElementById("predictionResult").innerHTML =
        `<h3>Lỗi kết nối máy chủ</h3>`;
    }
  });

// Hàm dùng chung vẽ kết quả (Đã khôi phục đủ 29 chỉ số)
function updateResultUI(d, res, idLabel) {
  const resultBox = document.getElementById("predictionResult");
  if (res.risk_level === "HIGH") {
    resultBox.className = "prediction-box danger";
    resultBox.innerHTML = `<h2>🔴 NGUY CƠ CAO (${res.risk_probability}%)</h2><p>Phát hiện nhiều chỉ số bất thường. Đề xuất can thiệp y tế khẩn cấp.</p>`;
    setAlarmStatus(true);
  } else if (res.risk_level === "WARNING") {
    resultBox.className = "prediction-box warning";
    resultBox.innerHTML = `<h2>🟠 CẢNH BÁO tiềm ẩn (${res.risk_probability}%)</h2><p>Bệnh nhân nằm trong vùng nguy cơ. Cần kiểm tra thêm.</p>`;
    setAlarmStatus(false);
  } else {
    resultBox.className = "prediction-box safe";
    resultBox.innerHTML = `<h2>🟢 NGUY CƠ THẤP (${res.risk_probability}%)</h2><p>Chưa phát hiện dấu hiệu đặc trưng.</p>`;
    setAlarmStatus(false);
  }

  document.getElementById("summaryInfo").innerHTML = `
        <strong style="color: #0f4c81; font-size: 16px;">Tóm tắt 29 chỉ số bệnh nhân (${idLabel}):</strong>
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
}

// 7. TÍNH NĂNG PHÓNG TO 3D (FULLSCREEN)
const btnFullscreen = document.getElementById("btnFullscreen");
const canvasContainer = document.getElementById("canvas-container");

btnFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    // Yêu cầu phóng to (Hỗ trợ nhiều trình duyệt)
    if (canvasContainer.requestFullscreen) {
      canvasContainer.requestFullscreen();
    } else if (canvasContainer.webkitRequestFullscreen) {
      /* Safari */
      canvasContainer.webkitRequestFullscreen();
    }
  } else {
    // Yêu cầu thu nhỏ
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      /* Safari */
      document.webkitExitFullscreen();
    }
  }
});

// Lắng nghe sự kiện ấn phím ESC của trình duyệt để đổi lại chữ trên nút
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    btnFullscreen.innerHTML = "🗗 Thu nhỏ";
    btnFullscreen.style.background = "rgba(0, 0, 0, 0.5)"; // Đổi nền tối cho dễ nhìn
  } else {
    btnFullscreen.innerHTML = "⛶ Phóng to";
    btnFullscreen.style.background = "rgba(255, 255, 255, 0.15)";
  }
});
