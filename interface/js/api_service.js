export async function fetchPrediction(patientData) {
  try {
    const response = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData),
    });
    return await response.json();
  } catch (err) {
    console.error("Lỗi gọi API Python:", err);
    throw err;
  }
}
