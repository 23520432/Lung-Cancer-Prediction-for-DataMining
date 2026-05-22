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
        # Lấy dữ liệu 29 thuộc tính từ giao diện gửi lên
        data = request.json
        
        # Chuyển đổi dữ liệu thành DataFrame
        df_input = pd.DataFrame([data])
        
        # Danh sách các cột cần chuẩn hóa (Giống hệt file 02_Preprocessing)
        continuous_cols = [
            'age', 'education_years', 'income_level', 'smoking_years', 'cigarettes_per_day', 
            'pack_years', 'air_pollution_index', 'bmi', 'oxygen_saturation', 
            'fev1_x10', 'crp_level', 'exercise_hours_per_week', 'diet_quality', 
            'alcohol_units_per_week', 'healthcare_access'
        ]
        
        # Áp dụng chuẩn hóa (Scaling)
        df_input[continuous_cols] = scaler.transform(df_input[continuous_cols])
        
        # Dự đoán bằng mô hình DES
        prediction = model.predict(df_input)
        probability = model.predict_proba(df_input)[:, 1]
        
        # Trả kết quả về cho Frontend
        return jsonify({
            'status': 'success',
            'is_high_risk': bool(prediction[0]),
            'risk_probability': round(float(probability[0]) * 100, 2)
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)