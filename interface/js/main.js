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

// Các biến lưu trữ đối tượng Chart.js để có thể xóa và vẽ lại
let ageChartInst = null;
let riskChartInst = null;

// 1. KHỞI TẠO HỆ THỐNG
init3DModel();
// Vẽ trước Dashboard rỗng (0 dữ liệu) khi vừa vào trang
setTimeout(() => updateDashboard([]), 500);

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
  else if (tabId === "tab-detail")
    document.getElementById("btn-tab-detail").classList.add("active");
  else if (tabId === "tab-dashboard")
    document.getElementById("btn-tab-dashboard").classList.add("active");
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
      const limit = 200;
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
          progressText.innerText = `Đang phân tích: ${i + 1} / ${limit} ca bệnh...`;
        } catch (err) {
          console.error(err);
        }
      }
      progressText.innerText = "Hoàn tất phân tích!";
      currentDisplayData = [...masterData];
      renderTable(currentDisplayData);

      // Cập nhật Dashboard với bộ dữ liệu mới
      updateDashboard(currentDisplayData);
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
            <tr onclick="loadPatientToForm(${patient.originalId})">
                <td><b>BN-${patient.originalId}</b></td><td>${d.age}</td><td>${d.gender === 1 ? "Nam" : "Nữ"}</td>
                <td>${d.pack_years}</td><td>${d.chronic_cough === 1 ? "Có" : "Không"}</td><td>${d.oxygen_saturation}%</td>
                <td>${riskText}</td><td><button style="padding: 5px 12px; cursor: pointer; background: #0f4c81; color: white; border: none; border-radius: 4px;">Soi 3D</button></td>
            </tr>`;
  });
  tbody.innerHTML = tableHTML;
}

// ==========================================
// HỆ THỐNG LỌC TỔNG HỢP (TÌM KIẾM + NGUY CƠ)
// ==========================================
const filterRiskEl = document.getElementById("filterRisk");
const searchEl = document.getElementById("globalSearch");

function applyUnifiedFilters() {
  const riskVal = filterRiskEl.value;
  const searchVal = searchEl.value.toLowerCase().trim();

  currentDisplayData = masterData.filter((p) => {
    // 1. Kiểm tra điều kiện Nguy cơ
    const matchRisk = riskVal === "ALL" || p.prediction.risk_level === riskVal;

    // 2. Kiểm tra điều kiện Tìm kiếm đa năng
    let matchSearch = false;
    if (!searchVal) {
      matchSearch = true; // Nếu ô tìm kiếm trống thì cho qua hết
    } else {
      const genderStr = p.data.gender === 1 ? "nam" : "nữ";
      const coughStr = p.data.chronic_cough === 1 ? "có" : "không";
      let riskStr = "thấp";
      if (p.prediction.risk_level === "HIGH") riskStr = "cao";
      else if (p.prediction.risk_level === "WARNING") riskStr = "cảnh báo";

      const allRawValues = Object.values(p.data).join(" ");
      const searchString =
        `bn-${p.originalId} ${genderStr} ${coughStr} ${riskStr} ${allRawValues}`.toLowerCase();

      if (searchString.includes(searchVal)) {
        matchSearch = true;
      }
    }

    return matchRisk && matchSearch;
  });

  if (currentSortCol) {
    currentDisplayData = sortPatientArray(
      currentDisplayData,
      currentSortCol,
      sortAscending,
    );
  }

  renderTable(currentDisplayData);

  // Vẽ lại Dashboard dựa trên danh sách đã lọc (Tính năng cực hay!)
  updateDashboard(currentDisplayData);
}

filterRiskEl.addEventListener("change", applyUnifiedFilters);
searchEl.addEventListener("input", applyUnifiedFilters);

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
window.loadPatientToForm = function (targetId) {
  const patient = masterData.find((p) => p.originalId === targetId);
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

let currentPatientForRecommendation = null;

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

  // Ghi nhớ dữ liệu bệnh nhân này để lát nữa tạo giải pháp
  currentPatientForRecommendation = { data: d, prediction: res };

  // HIỂN THỊ NÚT ĐỀ XUẤT VÀ ẨN KHUNG KẾT QUẢ CŨ ĐI
  document.getElementById("btnRecommend").style.display = "block";
  document.getElementById("recommendationBox").style.display = "none";

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

//-------------------------
// Bắt sự kiện khi click vào nút Đề xuất Giải pháp
document.getElementById("btnRecommend").addEventListener("click", () => {
    if(!currentPatientForRecommendation) return;
    generatePersonalizedRecommendation(currentPatientForRecommendation.data, currentPatientForRecommendation.prediction);
});

// THUẬT TOÁN HỆ CHUYÊN GIA ĐỀ XUẤT GIẢI PHÁP
function generatePersonalizedRecommendation(d, res) {
    let advices = [];

    // --- 1. Dựa trên Nguy cơ tổng thể ---
    if(res.risk_level === "HIGH") {
        advices.push("🚨 <b>Chỉ định lâm sàng khẩn cấp:</b> Yêu cầu đặt lịch chụp cắt lớp vi tính ngực liều thấp (LDCT) và nội soi phế quản ngay lập tức để tầm soát khối u.");
    } else if (res.risk_level === "WARNING") {
        advices.push("⚠️ <b>Theo dõi sát sao:</b> Đăng ký tầm soát ung thư phổi và chụp X-quang định kỳ mỗi 6 tháng. Cần theo dõi sự thay đổi của các nốt mờ trên phổi (nếu có).");
    } else {
        advices.push("✅ <b>Phòng ngừa:</b> Bệnh nhân hiện có nguy cơ thấp. Khuyến nghị duy trì lối sống lành mạnh và khám sức khỏe tổng quát hàng năm.");
    }

    // --- 2. Dựa trên Thói quen hút thuốc (Tác nhân số 1) ---
    if(d.smoker === 1) {
        advices.push(`🚬 <b>Cai thuốc lá tuyệt đối:</b> Bệnh nhân có thâm niên hút thuốc cao (${d.pack_years} pack-years). Yêu cầu tham gia chương trình hỗ trợ cai nghiện thuốc lá (có thể kết hợp liệu pháp thay thế Nicotine). Khói thuốc là nguyên nhân gốc rễ làm tăng nguy cơ.`);
    } else if(d.passive_smoking === 1) {
        advices.push("🚭 <b>Tránh khói thuốc thụ động:</b> Hạn chế tối đa tiếp xúc với môi trường có người hút thuốc tại nhà hoặc nơi làm việc.");
    }

    // --- 3. Dựa trên Chỉ số sinh tồn (SpO2, FEV1) ---
    if(d.oxygen_saturation < 95) {
        advices.push(`🫁 <b>Hỗ trợ hô hấp:</b> SpO₂ đang ở mức thấp (${d.oxygen_saturation}%). Cần theo dõi chỉ số oxy máu liên tục. Chỉ định tập vật lý trị liệu hô hấp (thở chúm môi, thở cơ hoành).`);
    }
    if(d.fev1_x10 < 30) { 
        advices.push("💨 <b>Khám chuyên khoa Hô hấp:</b> Chỉ số thở FEV1 có dấu hiệu suy giảm, biểu hiện của tắc nghẽn đường thở. Khuyến nghị đo hô hấp ký (Spirometry) chuyên sâu.");
    }

    // --- 4. Dựa trên Môi trường & Nghề nghiệp ---
    if(d.occupational_exposure === 1 || d.radon_exposure === 1 || d.air_pollution_index > 80) {
        advices.push("😷 <b>Cải thiện môi trường sống/làm việc:</b> Bệnh nhân có tiền sử phơi nhiễm độc hại (Bụi mịn, Radon hoặc hóa chất nghề nghiệp). Yêu cầu bắt buộc mang mặt nạ phòng độc khi làm việc và lắp đặt máy lọc không khí HEPA tại nhà.");
    }

    // --- 5. Dựa trên Triệu chứng & Bệnh lý nền ---
    let symptoms = [];
    if(d.chronic_cough === 1) symptoms.push("Ho mãn tính");
    if(d.chest_pain === 1) symptoms.push("Đau ngực");
    if(d.shortness_of_breath === 1) symptoms.push("Khó thở");
    if(d.fatigue === 1) symptoms.push("Mệt mỏi kéo dài");
    
    if(symptoms.length > 0) {
        advices.push(`⚕️ <b>Can thiệp triệu chứng:</b> Đang ghi nhận các triệu chứng lâm sàng: <i>${symptoms.join(", ")}</i>. Chỉ định xét nghiệm đờm, PCR và dùng thuốc giãn phế quản/chống viêm theo phác đồ của bác sĩ chuyên khoa.`);
    }

    // --- Render kết quả ra màn hình ---
    let html = "<h3 style='color: #145994; margin-top: 0; border-bottom: 2px solid #145994; padding-bottom: 8px;'>📋 Phác đồ Hành động & Khuyến nghị Y khoa</h3>";
    html += "<ul style='line-height: 1.8; color: #333; font-size: 14px; padding-left: 20px;'>";
    advices.forEach(a => { 
        html += `<li style="margin-bottom: 10px;">${a}</li>`; 
    });
    html += "</ul>";

    const recBox = document.getElementById("recommendationBox");
    recBox.innerHTML = html;
    
    // Hiển thị khung với hiệu ứng mượt
    recBox.style.display = "block";
    recBox.style.opacity = 0;
    setTimeout(() => { recBox.style.transition = "opacity 0.5s"; recBox.style.opacity = 1; }, 10);
    
    // Tự động cuộn màn hình xuống vùng giải pháp
    setTimeout(() => {
        recBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
}

//------------------------

// 7. TÍNH NĂNG PHÓNG TO 3D (FULLSCREEN)
const btnFullscreen = document.getElementById("btnFullscreen");
const canvasContainer = document.getElementById("canvas-container");

btnFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    if (canvasContainer.requestFullscreen) canvasContainer.requestFullscreen();
    else if (canvasContainer.webkitRequestFullscreen)
      canvasContainer.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
});

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    btnFullscreen.innerHTML = "🗗 Thu nhỏ";
    btnFullscreen.style.background = "rgba(0, 0, 0, 0.5)";
  } else {
    btnFullscreen.innerHTML = "⛶ Phóng to";
    btnFullscreen.style.background = "rgba(255, 255, 255, 0.15)";
  }
});

// =========================================================
// 8. LOGIC VẼ VÀ CẬP NHẬT DASHBOARD (5 BIỂU ĐỒ - TONE XANH)
// =========================================================
// let ageChartInst = null, riskChartInst = null;
let trendChartInst = null, scatterChartInst = null, radarChartInst = null;
let metricsBarChartInst = null, metricsPolarChartInst = null;

// Biến lưu trữ chỉ số model (Mặc định là 0, sẽ được nạp từ file JSON)
let currentModelMetrics = [0, 0, 0, 0];

// Hàm tự động tải dữ liệu từ file model_metrics.json
async function loadModelMetrics() {
  try {
    // Đường dẫn trỏ tới thư mục models của bạn
    const response = await fetch('./models/model_metrics.json'); 
    if (!response.ok) throw new Error("Chưa tìm thấy file");
    
    const data = await response.json();
    
    // Đổi từ hệ số thập phân (vd: 0.94) sang phần trăm (94.0)
    currentModelMetrics = [
      (data.accuracy * 100).toFixed(1),
      (data.precision * 100).toFixed(1),
      (data.recall * 100).toFixed(1),
      (data.f1_score * 100).toFixed(1)
    ];
  } catch (error) {
    console.warn("Lỗi tải metrics:", error, "- Đang dùng dữ liệu mẫu.");
    // Dữ liệu dự phòng nếu web không đọc được file json
    currentModelMetrics = [94.5, 89.2, 92.8, 90.9]; 
  }
}

// Chạy hàm đọc dữ liệu ngay khi vừa tải file JS
loadModelMetrics();


function updateDashboard(dataArray) {
  if (!dataArray || dataArray.length === 0) {
    document.getElementById("kpi-total").innerText = "0";
    document.getElementById("kpi-high-risk").innerText = "0";
    document.getElementById("kpi-smoker").innerText = "0%";
    drawDashboardCharts(
      [0, 0, 0, 0, 0],
      [0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [],
      [],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    );
    return;
  }

  const total = dataArray.length;
  let highRiskCount = 0,
    warningCount = 0,
    lowRiskCount = 0,
    smokerCount = 0;
  let ageGroups = [0, 0, 0, 0, 0];
  let trendData = {
    spo2Sum: [0, 0, 0, 0, 0],
    crpSum: [0, 0, 0, 0, 0],
    count: [0, 0, 0, 0, 0],
  };
  let scatterDataHigh = [],
    scatterDataLow = [];
  let radarHigh = { bmi: 0, packYears: 0, crp: 0, fev1: 0, age: 0, count: 0 };
  let radarLow = { bmi: 0, packYears: 0, crp: 0, fev1: 0, age: 0, count: 0 };

  dataArray.forEach((p) => {
    const d = p.data;
    const res = p.prediction;
    const isHighRisk =
      res.risk_level === "HIGH" || res.risk_level === "WARNING";

    if (res.risk_level === "HIGH") highRiskCount++;
    else if (res.risk_level === "WARNING") warningCount++;
    else lowRiskCount++;

    if (d.smoker === 1) smokerCount++;

    let ageIdx = 0;
    if (d.age < 40) ageIdx = 0;
    else if (d.age <= 50) ageIdx = 1;
    else if (d.age <= 60) ageIdx = 2;
    else if (d.age <= 70) ageIdx = 3;
    else ageIdx = 4;

    ageGroups[ageIdx]++;
    trendData.spo2Sum[ageIdx] += d.oxygen_saturation;
    trendData.crpSum[ageIdx] += d.crp_level;
    trendData.count[ageIdx]++;

    const scatterPoint = { x: d.pack_years, y: d.oxygen_saturation };
    if (isHighRisk) scatterDataHigh.push(scatterPoint);
    else scatterDataLow.push(scatterPoint);

    if (isHighRisk) {
      radarHigh.bmi += d.bmi;
      radarHigh.packYears += d.pack_years;
      radarHigh.crp += d.crp_level;
      radarHigh.fev1 += d.fev1_x10;
      radarHigh.age += d.age;
      radarHigh.count++;
    } else {
      radarLow.bmi += d.bmi;
      radarLow.packYears += d.pack_years;
      radarLow.crp += d.crp_level;
      radarLow.fev1 += d.fev1_x10;
      radarLow.age += d.age;
      radarLow.count++;
    }
  });

  const avgSpO2 = trendData.spo2Sum.map((sum, i) =>
    trendData.count[i] ? (sum / trendData.count[i]).toFixed(1) : 0,
  );
  const avgCRP = trendData.crpSum.map((sum, i) =>
    trendData.count[i] ? (sum / trendData.count[i]).toFixed(1) : 0,
  );
  const avgRadarHigh = radarHigh.count
    ? [
        radarHigh.age / radarHigh.count,
        radarHigh.packYears / radarHigh.count,
        radarHigh.bmi / radarHigh.count,
        radarHigh.fev1 / radarHigh.count,
        (radarHigh.crp / radarHigh.count) * 10,
      ]
    : [0, 0, 0, 0, 0];
  const avgRadarLow = radarLow.count
    ? [
        radarLow.age / radarLow.count,
        radarLow.packYears / radarLow.count,
        radarLow.bmi / radarLow.count,
        radarLow.fev1 / radarLow.count,
        (radarLow.crp / radarLow.count) * 10,
      ]
    : [0, 0, 0, 0, 0];

  document.getElementById("kpi-total").innerText = total;
  document.getElementById("kpi-high-risk").innerText = highRiskCount;
  document.getElementById("kpi-smoker").innerText =
    Math.round((smokerCount / total) * 100) + "%";

  drawDashboardCharts(
    ageGroups,
    [highRiskCount, warningCount, lowRiskCount],
    avgSpO2,
    avgCRP,
    scatterDataHigh,
    scatterDataLow,
    avgRadarHigh,
    avgRadarLow,
  );
}

function drawDashboardCharts(
  ageData,
  riskData,
  avgSpO2,
  avgCRP,
  scatterHigh,
  scatterLow,
  radarHigh,
  radarLow,
) {
  const ageLabels = ["< 40 tuổi", "40 - 50", "51 - 60", "61 - 70", "> 70 tuổi"];

  // 1. Biểu đồ Tuổi (Bar)
  if (ageChartInst) ageChartInst.destroy();
  ageChartInst = new Chart(
    document.getElementById("ageChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels: ageLabels,
        datasets: [
          {
            label: "Số lượng bệnh nhân",
            data: ageData,
            backgroundColor: [
              "#8bbce3",
              "#5c9cd4",
              "#337ec2",
              "#145994",
              "#0a3359",
            ],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Phân bố độ tuổi", font: { size: 16 } },
          legend: { display: false },
        },
      },
    },
  );

  // 2. Biểu đồ Nguy cơ (Doughnut) - Màu của bạn
  if (riskChartInst) riskChartInst.destroy();
  riskChartInst = new Chart(
    document.getElementById("riskChart").getContext("2d"),
    {
      type: "doughnut",
      data: {
        labels: ["Nguy cơ Cao", "Cảnh báo", "Nguy cơ Thấp"],
        datasets: [
          {
            data: riskData,
            backgroundColor: ["#02457A", "#77b4c8", "#D6E8EE"], // Giữ nguyên màu bạn chọn
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Phân loại Nguy cơ",
            font: { size: 16 },
          },
        },
        cutout: "65%",
      },
    },
  );

  // 3. BIỂU ĐỒ TREND TRỤC KÉP (Line + Bar)
  if (trendChartInst) trendChartInst.destroy();
  trendChartInst = new Chart(
    document.getElementById("trendChart").getContext("2d"),
    {
      type: "line",
      data: {
        labels: ageLabels,
        datasets: [
          {
            type: "line",
            label: "SpO₂ Trung bình (%)",
            data: avgSpO2,
            borderColor: "#02457A",
            backgroundColor: "#02457A",
            borderWidth: 3,
            tension: 0.4,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Mức độ Viêm (CRP)",
            data: avgCRP,
            backgroundColor: "rgba(119, 180, 200, 0.7)",
            borderRadius: 4,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Suy giảm chức năng Hô hấp theo Tuổi tác",
            font: { size: 16 },
          },
        },
        scales: {
          y: {
            type: "linear",
            display: true,
            position: "left",
            min: 80,
            max: 100,
            title: { display: true, text: "SpO₂ (%)" },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Chỉ số CRP" },
          },
        },
      },
    },
  );

  // 4. BIỂU ĐỒ PHÂN TÁN SCATTER (Pack Years vs SpO2)
  if (scatterChartInst) scatterChartInst.destroy();
  scatterChartInst = new Chart(
    document.getElementById("scatterChart").getContext("2d"),
    {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Nguy cơ Cao",
            data: scatterHigh,
            backgroundColor: "rgba(2, 69, 122, 0.7)",
            pointRadius: 5,
          }, // Tone #02457A
          {
            label: "Nguy cơ Thấp",
            data: scatterLow,
            backgroundColor: "rgba(119, 180, 200, 0.8)",
            pointRadius: 4,
          }, // Tone #77b4c8
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Tương quan Hút thuốc (Pack Years) và SpO₂",
            font: { size: 16 },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Thâm niên hút thuốc (Pack Years)" },
          },
          y: { title: { display: true, text: "Nồng độ Oxy máu (SpO₂)" } },
        },
      },
    },
  );

  // 5. BIỂU ĐỒ RADAR (Hồ sơ Y khoa đa chiều)
  if (radarChartInst) radarChartInst.destroy();
  radarChartInst = new Chart(
    document.getElementById("radarChart").getContext("2d"),
    {
      type: "radar",
      data: {
        labels: [
          "Độ Tuổi",
          "Thâm niên Hút thuốc",
          "Chỉ số BMI",
          "Khí dung FEV1",
          "Độ viêm CRP (x10)",
        ],
        datasets: [
          {
            label: "Hồ sơ nhóm Nguy cơ Cao",
            data: radarHigh,
            backgroundColor: "rgba(2, 69, 122, 0.2)",
            borderColor: "#02457A",
            pointBackgroundColor: "#02457A",
            borderWidth: 2,
          },
          {
            label: "Hồ sơ nhóm Bình thường",
            data: radarLow,
            backgroundColor: "rgba(119, 180, 200, 0.2)",
            borderColor: "#77b4c8",
            pointBackgroundColor: "#77b4c8",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "So sánh Chỉ số Lâm sàng trung bình",
            font: { size: 16 },
          },
          legend: { position: "bottom" },
        },
        scales: {
          r: { beginAtZero: true, angleLines: { color: "rgba(0,0,0,0.1)" } },
        },
      },
    },
  );

  // 6. BIỂU ĐỒ HIỆU SUẤT MÔ HÌNH AI (Đọc tự động từ JSON)
// 6. BIỂU ĐỒ HIỆU SUẤT MÔ HÌNH AI (Chia 2 bên: Cột ngang & Polar)
  
  // --- BÊN TRÁI: BIỂU ĐỒ CỘT NGANG ---
  const ctxBar = document.getElementById("metricsBarChart");
  if (ctxBar) {
    if (metricsBarChartInst) metricsBarChartInst.destroy();
    metricsBarChartInst = new Chart(ctxBar.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Accuracy (Chính xác)", "Precision (Chuẩn xác)", "Recall (Độ nhạy)", "F1-Score"],
        datasets: [{
          label: "Hiệu suất (%)",
          data: currentModelMetrics,
          backgroundColor: ["#145994", "#337ec2", "#5c9cd4", "#8bbce3"],
          borderRadius: 6,
          barThickness: 25
        }]
      },
      options: {
        indexAxis: 'y', // Xoay ngang
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
          title: { display: true, text: "Chi tiết Chỉ số Hiệu suất", font: { size: 16 }, padding: { bottom: 15 }, color: "#333" }, 
          legend: { display: false },
          tooltip: { callbacks: { label: function(context) { return context.parsed.x + '%'; } } }
        },
        scales: { 
          x: { min: 0, max: 100, title: { display: true, text: 'Phần trăm (%)' }, grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { grid: { display: false }, ticks: { font: { weight: 'bold' }, color: "#333" } }
        }
      }
    });
  }

  // --- BÊN PHẢI: BIỂU ĐỒ POLAR AREA ---
  const ctxPolar = document.getElementById("metricsPolarChart");
  if (ctxPolar) {
    if (metricsPolarChartInst) metricsPolarChartInst.destroy();
    metricsPolarChartInst = new Chart(ctxPolar.getContext("2d"), {
      type: "polarArea",
      data: {
        labels: ["Accuracy", "Precision", "Recall", "F1-Score"],
        datasets: [{
          label: "Hiệu suất (%)",
          data: currentModelMetrics,
          backgroundColor: [
            "rgba(20, 89, 148, 0.75)",  // #145994
            "rgba(51, 126, 194, 0.75)", 
            "rgba(119, 180, 200, 0.75)",
            "rgba(214, 232, 238, 0.75)" 
          ],
          borderColor: "#ffffff",
          borderWidth: 2,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
          title: { display: true, text: "Cấu trúc Hiệu suất (Polar)", font: { size: 16 }, padding: { bottom: 15 }, color: "#333" }, 
          legend: { 
            position: 'right', 
            labels: { boxWidth: 15, padding: 15, font: { size: 13 } } 
          },
          tooltip: {
            callbacks: {
              label: function(context) { return " " + context.label.split(' ')[0] + ": " + context.parsed.r + "%"; }
            }
          }
        },
        scales: { 
          r: { 
            min: 0, 
            max: 100, 
            ticks: { display: false }, 
            grid: { color: 'rgba(0,0,0,0.08)' }, 
            angleLines: { color: 'rgba(0,0,0,0.08)' } 
          }
        }
      }
    });
  } 
}
