from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np

# --- ĐOẠN VÁ LỖI PHIÊN BẢN (Cần thiết để load model DES) ---
from sklearn.base import BaseEstimator
from sklearn.utils.validation import check_X_y
if not hasattr(BaseEstimator, '_validate_data'):
    def _validate_data_patch(self, X, y=None, reset=True, validate_separately=False, **check_params):
        return check_X_y(X, y, **check_params)
    BaseEstimator._validate_data = _validate_data_patch
# -----------------------------------------------------------

app = Flask(__name__)
CORS(app) # Cho phép Frontend từ file HTML gọi được API

# Tải mô hình và bộ chuẩn hóa đã lưu
scaler = joblib.load('models/scaler.pkl')
model = joblib.load('models/des_model.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # 1. Lấy dữ liệu từ giao diện web gửi lên
        data = request.json
        df_input = pd.DataFrame([data])
        
        # =========================================================
        # GIẢI PHÁP TƯỜNG MINH: Khai báo chính xác thứ tự 29 cột 
        # Khớp 100% với file train_processed.csv
        # =========================================================
        expected_cols = [
            'age', 'gender', 'education_years', 'income_level', 'smoker',
            'smoking_years', 'cigarettes_per_day', 'pack_years', 'passive_smoking',
            'air_pollution_index', 'occupational_exposure', 'radon_exposure',
            'family_history_cancer', 'copd', 'asthma', 'previous_tb',
            'chronic_cough', 'chest_pain', 'shortness_of_breath', 'fatigue',
            'bmi', 'oxygen_saturation', 'fev1_x10', 'crp_level', 'xray_abnormal',
            'exercise_hours_per_week', 'diet_quality', 'alcohol_units_per_week',
            'healthcare_access'
        ]
        
        # Ép DataFrame phải sắp xếp cột theo đúng danh sách trên
        df_input = df_input[expected_cols]
        
        # 2. CHỈ CHUẨN HÓA 15 CỘT LIÊN TỤC (Giữ nguyên 14 cột nhị phân 0/1)
        continuous_cols = [
            'age', 'education_years', 'income_level', 'smoking_years', 'cigarettes_per_day', 
            'pack_years', 'air_pollution_index', 'bmi', 'oxygen_saturation', 
            'fev1_x10', 'crp_level', 'exercise_hours_per_week', 'diet_quality', 
            'alcohol_units_per_week', 'healthcare_access'
        ]
        
        # Transform 15 cột này và dán ngược lại vào DataFrame
        df_input[continuous_cols] = scaler.transform(df_input[continuous_cols])
        
        # 3. Chạy mô hình dự đoán
        probability = model.predict_proba(df_input)[:, 1]
        prob_value = round(float(probability[0]) * 100, 2)
        
        # Tự động phân loại 3 mức độ (Traffic Light System)
        if prob_value < 40:
            risk_level = 'LOW'
        elif prob_value < 70:
            risk_level = 'WARNING'
        else:
            risk_level = 'HIGH'
        
        # Trả kết quả về
        return jsonify({
            'status': 'success',
            'risk_level': risk_level,
            'risk_probability': prob_value
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)