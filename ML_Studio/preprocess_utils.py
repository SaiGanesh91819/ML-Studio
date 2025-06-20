import pandas as pd  # type:ignore
import numpy as np
from sklearn.preprocessing import MinMaxScaler, StandardScaler, OneHotEncoder, LabelEncoder
import math
import logging

# Configure logging for this module
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def handle_missing_values(df, method):
    df_copy = df.copy()
    if method == 'drop':
        return df_copy.dropna()
    elif method == 'mean':
        return df_copy.fillna(df_copy.mean(numeric_only=True))
    elif method == 'median':
        return df_copy.fillna(df_copy.median(numeric_only=True))
    elif method == 'mode':
        for col in df_copy.columns:
            mode_val = df_copy[col].mode()
            if not mode_val.empty:
                df_copy[col] = df_copy[col].fillna(mode_val[0])
            else:
                df_copy[col] = df_copy[col].fillna(np.nan)
        return df_copy
    else:
        raise ValueError("Invalid method for handle_missing_values.")

def remove_duplicates(df, columns=None):
    if columns:
        return df.drop_duplicates(subset=columns)
    return df.drop_duplicates()

def fix_data_consistency(df, column):
    if column in df.columns:
        df_copy = df.copy()
        df_copy[column] = df_copy[column].astype(str).str.lower().str.strip()
        return df_copy
    else:
        raise ValueError(f"Column {column} not found.")
    return df

def normalize_data(df, method, columns, min_range=0, max_range=1):
    df_normalized = df.copy()
    for col in columns:
        if pd.api.types.is_numeric_dtype(df[col]) and not pd.api.types.is_bool_dtype(df[col]):  # Only normalize numeric columns
            if method == 'minmax':
                min_val = df[col].min()
                max_val = df[col].max()
                if max_val == min_val:
                    df_normalized[col] = df[col]  # Avoid division by zero
                else:
                    df_normalized[col] = min_range + (df[col] - min_val) * (max_range - min_range) / (max_val - min_val)
            elif method == 'zscore':
                mean = df[col].mean()
                std = df[col].std()
                if std != 0:
                    df_normalized[col] = (df[col] - mean) / std
                else:
                    df_normalized[col] = df[col]  # Avoid division by zero
            else:
                raise ValueError(f"Unknown normalization method: {method}")
        else:
            logger.warning(f"Skipping normalization for non-numeric column: {col}")
    return df_normalized

def encode_categorical(df, method, column):
    df_encoded = df.copy()
    if method == 'label':
        df_encoded[column] = pd.Categorical(df[column]).codes
    elif method == 'onehot':
        df_encoded = pd.get_dummies(df, columns=[column], prefix=column)
    else:
        raise ValueError(f"Unknown encoding method: {method}")
    return df_encoded

def correlation_analysis(df):
    numeric_df = df.select_dtypes(include=np.number)
    if numeric_df.empty or len(numeric_df.columns) < 2:
        return {"message": "Not enough numeric data for correlation."}
    try:
        corr = numeric_df.corr()
        corr_dict = corr.to_dict()
        return replace_nan_inf_with_none(corr_dict)
    except Exception as e:
        print(f"Error in correlation calculation: {e}")
        return {"error": f"Could not calculate correlation: {str(e)}"}

def replace_nan_inf_with_none(obj):
    if isinstance(obj, dict):
        return {k: replace_nan_inf_with_none(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_nan_inf_with_none(elem) for elem in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)) and (np.isnan(obj) or np.isinf(obj)):
        return None
    elif isinstance(obj, (np.int_, np.intc, np.intp, np.int8, np.int16, np.int32, np.int64, np.uint8, np.uint16, np.uint32, np.uint64)):
        return int(obj)
    elif isinstance(obj, pd.Timestamp):
        try:
            if pd.isna(obj): return None
            return obj.isoformat()
        except ValueError:
            return None
    return obj