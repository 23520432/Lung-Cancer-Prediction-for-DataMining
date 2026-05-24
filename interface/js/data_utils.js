// Dọn dẹp số liệu từ CSV
export const cleanFloat = (val, def) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? def : parsed;
};
export const cleanInt = (val, def) => {
  const parsed = Math.round(parseFloat(val));
  return isNaN(parsed) ? def : parsed;
};

// Dọn dẹp số liệu từ Form HTML
export const safeFloat = (id, def) => {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? def : v;
};
export const safeInt = (id, def) => {
  const v = parseInt(document.getElementById(id).value);
  return isNaN(v) ? def : v;
};

// Thuật toán sắp xếp mảng dữ liệu (Click-to-sort)
export function sortPatientArray(dataArray, col, isAsc) {
  return dataArray.sort((a, b) => {
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
}
