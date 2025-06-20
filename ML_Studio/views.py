import os
import csv
import base64
import io
import chardet  # type:ignore
import pandas as pd  # type:ignore
from django.http import JsonResponse  # type:ignore
from django.conf import settings  # type:ignore
from django.shortcuts import render  # type:ignore
from django.views.decorators.csrf import csrf_exempt  # type:ignore
from collections import Counter
import numpy as np
import logging
from django.http import HttpResponse, JsonResponse  # type:ignore
from .preprocess_utils import (handle_missing_values, remove_duplicates, fix_data_consistency,
                              normalize_data, encode_categorical, correlation_analysis,
                              replace_nan_inf_with_none)
import traceback
import math
import logging
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def detect_encoding_robust(file_bytes):
    try:
        result = chardet.detect(file_bytes[:4096])
        encoding = result['encoding'] if result['encoding'] else 'utf-8'
        return encoding if encoding else 'utf-8'
    except Exception as e:
        logger.error(f"Encoding detection failed: {e}")
        return 'utf-8'

def infer_column_types(df):
    if df.empty:
        logger.warning("Empty DataFrame in infer_column_types")
        return df

    for col in df.columns:
        try:
            # Replace empty strings and whitespace with NaN before inference
            df[col] = df[col].replace('', np.nan).replace(' ', np.nan)

            # Try numeric conversion (allow float for missing values)
            try:
                temp = pd.to_numeric(df[col], errors='coerce')
                if temp.notna().sum() > 0:  # Ensure some valid numeric data
                    if temp.isna().sum() == 0 and temp.dtype in ['int8', 'int16', 'int32', 'int64']:
                        df[col] = temp.astype('Int64')  # Nullable integer
                    else:
                        df[col] = temp.astype('float64')  # Float for missing values
                    logger.info(f"Column {col} inferred as numeric: {df[col].dtype}")
                    continue
            except (ValueError, TypeError):
                pass

            # Try boolean conversion (support Yes/No and True/False)
            unique_vals = df[col].dropna().astype(str).str.lower().unique()
            boolean_indicators = {'true', 'false', '1', '0', 'yes', 'no'}
            if set(unique_vals).issubset(boolean_indicators):
                mapping = {'true': True, 'false': False, '1': True, '0': False, 'yes': True, 'no': False}
                df[col] = df[col].astype(str).str.lower().map(mapping).astype('boolean')
                logger.info(f"Column {col} inferred as boolean: {df[col].dtype}")
                continue

            # Try datetime conversion
            try:
                temp = pd.to_datetime(df[col], errors='coerce')  # Removed infer_datetime_format
                if temp.notna().sum() > 0 and temp.isna().sum() <= len(df[col]) * 0.1:  # Allow 10% parse failures
                    df[col] = temp
                    logger.info(f"Column {col} inferred as datetime: {df[col].dtype}")
                    continue
            except (ValueError, TypeError):
                pass

            # Check for categorical (adjust threshold for small datasets)
            unique_count = df[col].nunique()
            total_rows = len(df)
            if unique_count > 1 and unique_count <= min(total_rows, 50):  # Categorical if unique values are limited
                df[col] = df[col].astype('category')
                logger.info(f"Column {col} inferred as category: {df[col].dtype}")
            else:
                # Default to string if no other type fits
                df[col] = df[col].astype(str).replace('nan', np.nan)
                logger.info(f"Column {col} inferred as object: {df[col].dtype}")

        except Exception as e:
            logger.error(f"Type inference failed for column {col}: {e}")
            df[col] = df[col].astype(str).replace('nan', np.nan)
    return df

def react_view(request):
    return render(request, 'react/index.html')

def index_page(request):
    return render(request, 'index.html')

@csrf_exempt
def workplace(request):
    if request.method == 'POST' and request.FILES.get('file'):
        try:
            uploaded_file = request.FILES['file']
            allowed_extensions = ['csv', 'xls', 'xlsx']
            file_extension = uploaded_file.name.split('.').pop().lower()
            if file_extension not in allowed_extensions:
                return JsonResponse({'error': 'Invalid file type. Use csv, xls, or xlsx.'}, status=400)

            # Generate unique filename to avoid conflicts
            unique_id = str(uuid.uuid4())
            file_name = f"{unique_id}_{uploaded_file.name}"
            file_path = os.path.join(settings.TEMP_FILE_STORAGE_DIR, file_name)

            # Save file to disk in chunks
            with open(file_path, 'wb') as f:
                for chunk in uploaded_file.chunks():
                    f.write(chunk)

            # Store metadata in session
            request.session['uploaded_file_name'] = uploaded_file.name
            request.session['uploaded_file_path'] = file_path
            request.session.modified = True

            return JsonResponse({'file_name': uploaded_file.name})
        except Exception as e:
            logger.error(f"Workplace view error: {e}")
            return JsonResponse({'error': f'File upload failed: {str(e)}'}, status=500)
    else:
        return render(request, 'work_studio.html')

def calculate_stats_bundle(df, df_original):
    if df.empty or df_original.empty:
        logger.warning("Empty DataFrame in calculate_stats_bundle")
        return {
            'column_stats': {},
            'preprocessing_stats': {
                "hmv": {"drop_rows": {}, "fill_with_mean": {}, "fill_with_median": {}, "fill_with_mode": {}},
                "rd": {"remove_all_duplicates": {}, "remove_duplicates_specific_columns": {}},
                "fdc": {},
                "norm": {"min_max_normalization": {}, "z_score_normalization": {}},
                "ca": {},
                "ecd": {"label_encoding": {}, "one_hot_encoding": {}}
            },
            'dataset_stats': {'total_rows': 0, 'total_columns': 0, 'column_types': {}}
        }

    stats_results = {
        'column_stats': {},
        'preprocessing_stats': {
            "hmv": {"drop_rows": {}, "fill_with_mean": {}, "fill_with_median": {}, "fill_with_mode": {}},
            "rd": {"remove_all_duplicates": {}, "remove_duplicates_specific_columns": {}},
            "fdc": {},
            "norm": {"min_max_normalization": {}, "z_score_normalization": {}},
            "ca": {},
            "ecd": {"label_encoding": {}, "one_hot_encoding": {}}
        },
        'dataset_stats': {}
    }
    column_stats_dict = stats_results['column_stats']
    preprocessing_stats_dict = stats_results['preprocessing_stats']

    total_rows = len(df)
    total_columns = len(df.columns)
    column_types_counts = Counter(df.dtypes.astype(str))

    rows_with_missing = df.isna().any(axis=1).sum()
    preprocessing_stats_dict["hmv"]["drop_rows"]["dataset"] = {"rows_with_missing": int(rows_with_missing)}

    for col in df.columns:
        try:
            stats = {}
            series = df[col]
            original_series = df_original[col]
            data_type = str(series.dtype)

            stats['data_type'] = data_type
            stats['missing_count'] = int(series.isnull().sum())
            stats['missing_percentage'] = float((stats['missing_count'] / total_rows) * 100) if total_rows > 0 else 0
            current_unique_count = int(original_series.nunique())
            stats['unique_count'] = current_unique_count
            stats['unique_percentage'] = float((current_unique_count / total_rows) * 100) if total_rows > 0 else 0

            is_numeric = pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series)
            is_object = data_type == 'object'
            is_string = pd.api.types.is_string_dtype(series)
            is_category = pd.api.types.is_categorical_dtype(series)
            is_bool = pd.api.types.is_bool_dtype(series) or data_type == 'boolean'
            is_datetime = pd.api.types.is_datetime64_any_dtype(series)

            if is_numeric:
                try:
                    stats['mean'] = float(series.mean()) if total_rows > 0 and series.notna().sum() > 0 else np.nan
                    stats['median'] = float(series.median()) if total_rows > 0 and series.notna().sum() > 0 else np.nan
                    stats['std'] = float(series.std()) if total_rows > 0 and series.notna().sum() > 1 else np.nan
                    stats['variance'] = float(series.var()) if total_rows > 0 and series.notna().sum() > 1 else np.nan
                    stats['min'] = float(series.min()) if total_rows > 0 and series.notna().sum() > 0 else np.nan
                    stats['max'] = float(series.max()) if total_rows > 0 and series.notna().sum() > 0 else np.nan
                    stats['range'] = float(stats['max'] - stats['min']) if pd.notna(stats['min']) and pd.notna(stats['max']) else np.nan
                    stats['q1'] = float(series.quantile(0.25)) if total_rows > 0 and series.notna().sum() > 0 else np.nan
                    stats['q2'] = float(series.quantile(0.50)) if total_rows > 0 and series.notna().sum() > 0 else np.nan
                    stats['q3'] = float(series.quantile(0.75)) if total_rows > 0 and series.notna().sum() > 0 else np.nan
                    stats['iqr'] = float(stats['q3'] - stats['q1']) if pd.notna(stats['q1']) and pd.notna(stats['q3']) else np.nan
                    stats['skewness'] = float(series.skew()) if total_rows > 0 and series.notna().sum() > 2 else np.nan
                    stats['kurtosis'] = float(series.kurt()) if total_rows > 0 and series.notna().sum() > 3 else np.nan
                except Exception as e:
                    logger.error(f"Numeric stats failed for {col}: {e}")
                    for key in ['mean', 'median', 'std', 'variance', 'min', 'max', 'range', 'q1', 'q2', 'q3', 'iqr', 'skewness', 'kurtosis']:
                        stats[key] = np.nan
            elif is_object or is_string or is_category:
                stats['num_categories'] = current_unique_count
                top_n = original_series.dropna().value_counts().nlargest(5)
                stats['top_categories'] = [
                    {'value': str(val), 'count': int(count), 'percentage': float((count / total_rows) * 100) if total_rows > 0 else 0}
                    for val, count in top_n.items()
                ]
            elif is_bool:
                counts = series.value_counts()
                stats['true_count'] = int(counts.get(True, 0))
                stats['false_count'] = int(counts.get(False, 0))
                stats['true_percentage'] = float((stats['true_count'] / total_rows) * 100) if total_rows > 0 else 0
                stats['false_percentage'] = float((stats['false_count'] / total_rows) * 100) if total_rows > 0 else 0
            elif is_datetime:
                min_dt = series.min()
                max_dt = series.max()
                stats['earliest'] = min_dt if pd.notna(min_dt) else None
                stats['latest'] = max_dt if pd.notna(max_dt) else None
                stats['range_seconds'] = (max_dt - min_dt).total_seconds() if pd.notna(min_dt) and pd.notna(max_dt) else None

            mode_val = series.mode()
            mode_to_store = mode_val[0] if not mode_val.empty else np.nan

            if is_numeric:
                preprocessing_stats_dict["hmv"]["fill_with_mean"][col] = {"mean_value": stats.get('mean'), "affected_rows": stats['missing_count']}
                preprocessing_stats_dict["hmv"]["fill_with_median"][col] = {"median_value": stats.get('median'), "affected_rows": stats['missing_count']}
                preprocessing_stats_dict["hmv"]["fill_with_mode"][col] = {"mode_value": mode_to_store, "affected_rows": stats['missing_count']}
                preprocessing_stats_dict["norm"]["min_max_normalization"][col] = {"min_value": stats.get('min'), "max_value": stats.get('max'), "range": stats.get('range')}
                preprocessing_stats_dict["norm"]["z_score_normalization"][col] = {"mean_value": stats.get('mean'), "std_value": stats.get('std')}
                preprocessing_stats_dict["fdc"][col] = {"unique_values": int(series.nunique()), "data_type": data_type}
            elif is_object or is_string or is_category or is_bool:
                original_uniques = original_series.unique()
                preprocessing_stats_dict["ecd"]["label_encoding"][col] = {
                    "num_categories": stats.get('num_categories', current_unique_count),
                    "example_mapping": {str(val): i for i, val in enumerate(original_uniques[:5]) if pd.notna(val)}
                }
                preprocessing_stats_dict["ecd"]["one_hot_encoding"][col] = {
                    "num_categories": stats.get('num_categories', current_unique_count),
                    "new_columns": stats.get('num_categories', current_unique_count)
                }
                original_mode_val = original_series.mode()
                original_mode_to_store = original_mode_val[0] if not original_mode_val.empty else np.nan
                preprocessing_stats_dict["hmv"]["fill_with_mode"][col] = {"mode_value": original_mode_to_store, "affected_rows": stats['missing_count']}
                preprocessing_stats_dict["fdc"][col] = {"unique_values": current_unique_count, "data_type": data_type}
            elif is_datetime:
                preprocessing_stats_dict["hmv"]["fill_with_mode"][col] = {"mode_value": mode_to_store, "affected_rows": stats['missing_count']}
                preprocessing_stats_dict["fdc"][col] = {"unique_values": int(series.nunique()), "data_type": data_type}

            preprocessing_stats_dict["rd"]["remove_duplicates_specific_columns"][col] = {"duplicate_count": int(df_original[col].duplicated().sum())}

            column_stats_dict[col] = stats
        except Exception as e:
            logger.error(f"Stats calculation failed for column {col}: {e}")
            column_stats_dict[col] = {'data_type': data_type, 'error': str(e)}

    stats_results['dataset_stats'] = {
        'total_rows': int(total_rows),
        'total_columns': int(total_columns),
        'column_types': {k: int(v) for k, v in column_types_counts.items()},
    }
    preprocessing_stats_dict["rd"]["remove_all_duplicates"]["dataset"] = {
        "total_duplicate_rows": int(df_original.duplicated().sum()),
        "unique_rows_after": int(len(df_original.drop_duplicates()))
    }

    try:
        corr_result = correlation_analysis(df)
        preprocessing_stats_dict["ca"]["matrix"] = corr_result if isinstance(corr_result, dict) else {}
    except Exception as e:
        logger.error(f"Correlation analysis failed: {e}")
        preprocessing_stats_dict["ca"]["matrix"] = {"error": str(e)}

    stats_results['column_stats'] = replace_nan_inf_with_none(stats_results['column_stats'])
    stats_results['preprocessing_stats'] = replace_nan_inf_with_none(stats_results['preprocessing_stats'])
    stats_results['dataset_stats'] = replace_nan_inf_with_none(stats_results['dataset_stats'])

    return stats_results

@csrf_exempt
def finalize_upload(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method.'}, status=400)
    try:
        file_name = request.session.get('uploaded_file_name')
        file_path = request.session.get('uploaded_file_path')
        if not file_name or not file_path or not os.path.exists(file_path):
            return JsonResponse({'error': 'No file data in session or file not found.'}, status=400)

        file_extension = file_name.split(".")[-1].lower()
        encoding = detect_encoding_robust(file_path)

        df = None
        columns = []
        if file_extension == "csv":
            try:
                chunk_iter = pd.read_csv(file_path, encoding=encoding, chunksize=1000, iterator=True)
                first_chunk = next(chunk_iter)
                columns = first_chunk.columns.tolist()
                df = first_chunk
            except UnicodeDecodeError as e:
                logger.error(f"CSV decode error: {e}")
                return JsonResponse({'error': f'Failed to decode CSV with encoding {encoding}.'}, status=400)
            except Exception as e:
                logger.error(f"CSV read error: {e}")
                return JsonResponse({'error': f'Failed to read CSV: {str(e)}'}, status=500)
        elif file_extension in ["xls", "xlsx"]:
            try:
                df = pd.read_excel(file_path, engine='openpyxl')
                columns = df.columns.tolist()
            except Exception as e:
                logger.error(f"Excel read error: {e}")
                return JsonResponse({'error': f'Failed to read Excel file: {str(e)}'}, status=500)
        else:
            return JsonResponse({'error': 'Unsupported file format.'}, status=400)

        if df is None or df.empty:
            return JsonResponse({'error': 'Failed to load data or file is empty.'}, status=400)

        df_original_for_stats = df.copy()
        df = infer_column_types(df)

        stats_bundle = calculate_stats_bundle(df, df_original_for_stats)

        request.session['processed_file_path'] = file_path
        request.session['uploaded_file_encoding'] = encoding
        request.session.modified = True

        response_payload = {
            'columns': columns,
            'data': replace_nan_inf_with_none(df.values.tolist()),
            **stats_bundle
        }
        return JsonResponse(response_payload)

    except Exception as e:
        logger.error(f"Finalize upload error: {e}")
        return JsonResponse({'error': f"Failed to finalize upload: {str(e)}"}, status=500)

@csrf_exempt
def apply_preprocessing(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method.'}, status=400)
    try:
        file_name = request.session.get('uploaded_file_name')
        file_path = request.session.get('processed_file_path')
        saved_encoding = request.session.get('uploaded_file_encoding', 'utf-8')
        if not file_name or not file_path or not os.path.exists(file_path):
            return JsonResponse({'error': 'No file data in session or file not found.'}, status=400)

        file_extension = file_name.split(".")[-1].lower()
        chunksize = 1000

        df_modified = None
        action_summary = ""
        df = None

        if file_extension == "csv":
            try:
                chunk_iter = pd.read_csv(file_path, encoding=saved_encoding, chunksize=chunksize, iterator=True)
                first_chunk = next(chunk_iter)
                columns = first_chunk.columns.tolist()
                df = first_chunk
            except UnicodeDecodeError as e:
                logger.error(f"CSV decode error in apply: {e}")
                return JsonResponse({'error': f'Failed to decode session CSV: {saved_encoding}.'}, status=400)
            except Exception as e:
                logger.error(f"CSV read error in apply: {e}")
                return JsonResponse({'error': f'Failed to read session CSV: {str(e)}'}, status=500)
        elif file_extension in ["xls", "xlsx"]:
            try:
                df = pd.read_excel(file_path, engine='openpyxl')
                columns = df.columns.tolist()
            except Exception as e:
                logger.error(f"Excel read error in apply: {e}")
                return JsonResponse({'error': f'Failed to read session Excel: {str(e)}'}, status=500)
        else:
            return JsonResponse({'error': 'Unsupported file format in session.'}, status=400)

        if df is None or df.empty:
            return JsonResponse({'error': 'Failed to load DataFrame from session.'}, status=400)

        df_original_before_apply = df.copy()
        df = infer_column_types(df)

        option = request.POST.get('option')
        sub_option = request.POST.get('sub_option')
        selected_columns_str = request.POST.get('columns')
        selected_column = request.POST.get('column')
        selected_columns = [col.strip().lstrip('\ufeff') for col in selected_columns_str.split(',') if col.strip()] if selected_columns_str else None
        selected_column = selected_column.strip().lstrip('\ufeff') if selected_column else None
        min_range_str = request.POST.get('min_range', '0')
        max_range_str = request.POST.get('max_range', '1')

        logger.info(f"Received POST data: {dict(request.POST.items())}")

        hmv_method_map = {'Drop Rows': 'drop', 'Fill with Mean': 'mean', 'Fill with Median': 'median', 'Fill with Mode': 'mode'}
        norm_method_map = {'Min-Max Normalization': 'minmax', 'Z-score Standardization': 'zscore'}
        encode_method_map = {'Label Encoding': 'label', 'One-Hot Encoding': 'onehot'}

        if file_extension == "csv":
            output_file = os.path.join(settings.TEMP_FILE_STORAGE_DIR, f"processed_{str(uuid.uuid4())}_{file_name}")
            first_chunk = True

            for chunk in pd.read_csv(file_path, encoding=saved_encoding, chunksize=chunksize, iterator=True):
                chunk = infer_column_types(chunk)
                df_before_op = chunk.copy()

                try:
                    if option in ['Normalize Data', 'Normalization']:
                        method = norm_method_map.get(sub_option)
                        if not method:
                            return JsonResponse({'error': f'Invalid sub-option for Normalize Data: {sub_option}.'}, status=400)
                        if not selected_columns:
                            return JsonResponse({'error': 'Select at least one column for normalization.'}, status=400)
                        valid_cols = [c for c in selected_columns if c in chunk.columns and pd.api.types.is_numeric_dtype(chunk[c]) and not pd.api.types.is_bool_dtype(chunk[c])]
                        if not valid_cols:
                            return JsonResponse({'error': 'No valid numeric columns selected for normalization.'}, status=400)
                        min_r, max_r = 0, 1
                        if method == 'minmax':
                            try:
                                min_r = float(min_range_str)
                                max_r = float(max_range_str)
                                if min_r >= max_r:
                                    raise ValueError("Min range must be less than max range.")
                            except ValueError as e:
                                return JsonResponse({'error': f"Invalid range values: {str(e)}"}, status=400)
                        chunk = normalize_data(chunk, method, valid_cols, min_range=min_r, max_range=max_r) if method == 'minmax' else normalize_data(chunk, method, valid_cols)
                        action_summary = f"Applied '{sub_option}' to columns: {', '.join(valid_cols)}."
                    elif option == 'Handle Missing Values':
                        method = hmv_method_map.get(sub_option)
                        if not method:
                            return JsonResponse({'error': f'Invalid sub-option for Handle Missing Values: {sub_option}.'}, status=400)
                        if method == 'drop':
                            chunk = handle_missing_values(chunk, 'drop')
                            action_summary = "Removed rows with missing values."
                        elif method in ['mean', 'median', 'mode']:
                            if not selected_columns:
                                return JsonResponse({'error': f'Select at least one column for {sub_option}.'}, status=400)
                            is_mode = method == 'mode'
                            valid_cols = [c for c in selected_columns if c in chunk.columns and (is_mode or (pd.api.types.is_numeric_dtype(chunk[c]) and not pd.api.types.is_bool_dtype(chunk[c])))]
                            if not valid_cols:
                                return JsonResponse({'error': f'No valid columns for {sub_option}.'}, status=400)
                            for col in valid_cols:
                                if method == 'mean':
                                    fill_value = chunk[col].mean()
                                elif method == 'median':
                                    fill_value = chunk[col].median()
                                else:
                                    mode_val = chunk[col].mode()
                                    fill_value = mode_val[0] if not mode_val.empty else np.nan
                                if pd.notna(fill_value):
                                    chunk[col].fillna(fill_value, inplace=True)
                                    if pd.api.types.is_integer_dtype(chunk[col]) and pd.api.types.is_numeric_dtype(fill_value):
                                        chunk[col] = chunk[col].round().astype('Int64')
                            action_summary = f"Applied '{sub_option}' to columns: {', '.join(valid_cols)}."
                    elif option == 'Remove Duplicates':
                        if sub_option == 'Remove All Duplicates':
                            chunk = remove_duplicates(chunk)
                            action_summary = "Removed duplicate rows."
                        elif sub_option == 'Remove Duplicates (Specific Columns)':
                            if not selected_columns:
                                return JsonResponse({'error': 'Select at least one column for removing duplicates.'}, status=400)
                            valid_cols = [c for c in selected_columns if c in chunk.columns]
                            if not valid_cols:
                                return JsonResponse({'error': 'Selected columns not found in DataFrame.'}, status=400)
                            chunk = remove_duplicates(chunk, columns=valid_cols)
                            action_summary = f"Removed duplicates based on {', '.join(valid_cols)}."
                        else:
                            return JsonResponse({'error': f'Invalid sub-option for Remove Duplicates: {sub_option}.'}, status=400)
                    elif option == 'Fix Data Consistency':
                        if not selected_column:
                            return JsonResponse({'error': 'Select a column for Fix Data Consistency.'}, status=400)
                        if selected_column not in chunk.columns:
                            return JsonResponse({'error': f"Column '{selected_column}' not found in DataFrame."}, status=400)
                        if pd.api.types.is_string_dtype(chunk[selected_column]) or pd.api.types.is_categorical_dtype(chunk[selected_column]):
                            chunk = fix_data_consistency(chunk, selected_column)
                            action_summary = f"Standardized data in column: {selected_column}."
                        else:
                            return JsonResponse({'error': f"Fix Data Consistency requires a text or categorical column. '{selected_column}' is {chunk[selected_column].dtype}."}, status=400)
                    elif option == 'Encode Categorical Data':
                        method = encode_method_map.get(sub_option)
                        if not method:
                            return JsonResponse({'error': f'Invalid sub-option for Encode Categorical Data: {sub_option}.'}, status=400)
                        if not selected_column:
                            return JsonResponse({'error': 'Select a column for encoding.'}, status=400)
                        if selected_column not in chunk.columns:
                            return JsonResponse({'error': f"Column '{selected_column}' not found in DataFrame."}, status=400)
                        col_dtype = chunk[selected_column].dtype
                        if col_dtype not in ['category', 'object', 'boolean']:
                            return JsonResponse({'error': f"Encoding requires a categorical, object, or boolean column. '{selected_column}' is {col_dtype}."}, status=400)
                        chunk = encode_categorical(chunk, method, selected_column)
                        action_summary = f"Applied '{sub_option}' to column: {selected_column}."
                    elif option == 'Correlation Analysis':
                        corr_dict = correlation_analysis(chunk)
                        action_summary = "Computed correlation matrix."
                        stats_bundle = calculate_stats_bundle(chunk, df_original_before_apply)
                        stats_bundle['preprocessing_stats']['ca']['matrix'] = corr_dict
                        response_payload_ca = {
                            'columns': chunk.columns.tolist(),
                            'data': replace_nan_inf_with_none(chunk.values.tolist()),
                            **stats_bundle,
                            'action_summary': action_summary,
                            'correlation_matrix': corr_dict
                        }
                        return JsonResponse(response_payload_ca)
                    else:
                        return JsonResponse({'error': f'Invalid preprocessing option: {option}.'}, status=400)

                    mode = 'w' if first_chunk else 'a'
                    chunk.to_csv(output_file, mode=mode, index=False, encoding='utf-8', sep=',', quoting=csv.QUOTE_MINIMAL, header=first_chunk)
                    first_chunk = False

                except Exception as e:
                    logger.error(f"Preprocessing step error in chunk: {e}")
                    return JsonResponse({'error': f"Failed during preprocessing: {str(e)}"}, status=500)

        else:
            df = pd.read_excel(file_path, engine='openpyxl')
            df_before_op = df.copy()
            if option in ['Normalize Data', 'Normalization']:
                method = norm_method_map.get(sub_option)
                if not method:
                    return JsonResponse({'error': f'Invalid sub-option for Normalize Data: {sub_option}.'}, status=400)
                if not selected_columns:
                    return JsonResponse({'error': 'Select at least one column for normalization.'}, status=400)
                valid_cols = [c for c in selected_columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])]
                if not valid_cols:
                    return JsonResponse({'error': 'No valid numeric columns selected for normalization.'}, status=400)
                min_r, max_r = 0, 1
                if method == 'minmax':
                    try:
                        min_r = float(min_range_str)
                        max_r = float(max_range_str)
                        if min_r >= max_r:
                            raise ValueError("Min range must be less than max range.")
                    except ValueError as e:
                        return JsonResponse({'error': f"Invalid range values: {str(e)}"}, status=400)
                df_modified = normalize_data(df, method, valid_cols, min_range=min_r, max_range=max_r) if method == 'minmax' else normalize_data(df, method, valid_cols)
                action_summary = f"Applied '{sub_option}' to columns: {', '.join(valid_cols)}."
            elif option == 'Handle Missing Values':
                method = hmv_method_map.get(sub_option)
                if not method:
                    return JsonResponse({'error': f'Invalid sub-option for Handle Missing Values: {sub_option}.'}, status=400)
                if method == 'drop':
                    original_rows = len(df)
                    df_modified = handle_missing_values(df, 'drop')
                    action_summary = f"Removed {original_rows - len(df_modified)} rows with missing values."
                elif method in ['mean', 'median', 'mode']:
                    if not selected_columns:
                        return JsonResponse({'error': f'Select at least one column for {sub_option}.'}, status=400)
                    is_mode = method == 'mode'
                    valid_cols = [c for c in selected_columns if c in df.columns and (is_mode or (pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])))]
                    if not valid_cols:
                        return JsonResponse({'error': f'No valid columns for {sub_option}.'}, status=400)
                    df_modified = df.copy()
                    for col in valid_cols:
                        try:
                            if method == 'mean':
                                fill_value = df_modified[col].mean()
                            elif method == 'median':
                                fill_value = df_modified[col].median()
                            else:
                                mode_val = df_modified[col].mode()
                                fill_value = mode_val[0] if not mode_val.empty else np.nan
                            if pd.notna(fill_value):
                                df_modified[col].fillna(fill_value, inplace=True)
                                if pd.api.types.is_integer_dtype(df[col]) and pd.api.types.is_numeric_dtype(fill_value):
                                    df_modified[col] = df_modified[col].round().astype('Int64')
                        except Exception as e:
                            logger.error(f"Fill missing failed for {col}: {e}")
                            continue
                    action_summary = f"Applied '{sub_option}' to columns: {', '.join(valid_cols)}."
            elif option == 'Remove Duplicates':
                original_rows = len(df)
                if sub_option == 'Remove All Duplicates':
                    df_modified = remove_duplicates(df)
                    action_summary = f"Removed {original_rows - len(df_modified)} duplicate rows."
                elif sub_option == 'Remove Duplicates (Specific Columns)':
                    if not selected_columns:
                        return JsonResponse({'error': 'Select at least one column for removing duplicates.'}, status=400)
                    valid_cols = [c for c in selected_columns if c in df.columns]
                    if not valid_cols:
                        return JsonResponse({'error': 'Selected columns not found in DataFrame.'}, status=400)
                    df_modified = remove_duplicates(df, columns=valid_cols)
                    action_summary = f"Removed duplicates based on {', '.join(valid_cols)}. {original_rows - len(df_modified)} rows removed."
                else:
                    return JsonResponse({'error': f'Invalid sub-option for Remove Duplicates: {sub_option}.'}, status=400)
            elif option == 'Fix Data Consistency':
                if not selected_column:
                    return JsonResponse({'error': 'Select a column for Fix Data Consistency.'}, status=400)
                if selected_column not in df.columns:
                    return JsonResponse({'error': f"Column '{selected_column}' not found in DataFrame."}, status=400)
                if pd.api.types.is_string_dtype(df[selected_column]) or pd.api.types.is_categorical_dtype(df[selected_column]):
                    df_modified = fix_data_consistency(df, selected_column)
                    action_summary = f"Standardized data in column: {selected_column}."
                else:
                    return JsonResponse({'error': f"Fix Data Consistency requires a text or categorical column. '{selected_column}' is {df[selected_column].dtype}."}, status=400)
            elif option == 'Encode Categorical Data':
                method = encode_method_map.get(sub_option)
                if not method:
                    return JsonResponse({'error': f'Invalid sub-option for Encode Categorical Data: {sub_option}.'}, status=400)
                if not selected_column:
                    return JsonResponse({'error': 'Select a column for encoding.'}, status=400)
                if selected_column not in df.columns:
                    return JsonResponse({'error': f"Column '{selected_column}' not found in DataFrame."}, status=400)
                col_dtype = df[selected_column].dtype
                if col_dtype not in ['category', 'object', 'boolean']:
                    return JsonResponse({'error': f"Encoding requires a categorical, object, or boolean column. '{selected_column}' is {col_dtype}."}, status=400)
                df_modified = encode_categorical(df, method, selected_column)
                action_summary = f"Applied '{sub_option}' to column: {selected_column}."
            elif option == 'Correlation Analysis':
                corr_dict = correlation_analysis(df)
                action_summary = "Computed correlation matrix."
                stats_bundle = calculate_stats_bundle(df, df_original_before_apply)
                stats_bundle['preprocessing_stats']['ca']['matrix'] = corr_dict
                response_payload_ca = {
                    'columns': df.columns.tolist(),
                    'data': replace_nan_inf_with_none(df.values.tolist()),
                    **stats_bundle,
                    'action_summary': action_summary,
                    'correlation_matrix': corr_dict
                }
                return JsonResponse(response_payload_ca)
            else:
                return JsonResponse({'error': f'Invalid preprocessing option: {option}.'}, status=400)

            output_file = os.path.join(settings.TEMP_FILE_STORAGE_DIR, f"processed_{str(uuid.uuid4())}_{file_name}")
            df_modified.to_excel(output_file, index=False)

        if df_modified is None or df_before_op.equals(df_modified):
            action_summary += " (No changes applied)"
            df = df_before_op
        else:
            df = df_modified

        request.session['processed_file_path'] = output_file
        request.session.modified = True

        stats_bundle = calculate_stats_bundle(df, df_original_before_apply)

        response_payload_apply = {
            'columns': df.columns.tolist(),
            'data': replace_nan_inf_with_none(df.values.tolist()),
            **stats_bundle,
            'action_summary': action_summary
        }
        return JsonResponse(response_payload_apply)

    except Exception as e:
        logger.error(f"Apply preprocessing error: {e}")
        return JsonResponse({'error': f"Failed to apply preprocessing: {str(e)}"}, status=500)

@csrf_exempt
def download_preprocessed_file(request):
    try:
        file_name = request.session.get('uploaded_file_name')
        file_data_b64 = request.session.get('uploaded_file_data')
        if not file_name or not file_data_b64:
            return HttpResponse("No processed file data found in session.", status=404)
        file_data_decoded = base64.b64decode(file_data_b64)
        file_extension = file_name.split(".")[-1].lower()
        new_filename = f"pre_processed_{file_name}"
        content_type = 'application/octet-stream'
        if file_extension == 'csv':
            content_type = 'text/csv'
        elif file_extension == 'xlsx':
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        elif file_extension == 'xls':
            content_type = 'application/vnd.ms-excel'
        response = HttpResponse(file_data_decoded, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{new_filename}"'
        return response
    except Exception as e:
        logger.error(f"Download file error: {e}")
        return HttpResponse(f"Failed to generate file for download: {str(e)}", status=500)