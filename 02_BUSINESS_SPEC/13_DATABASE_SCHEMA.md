# CƠ SỞ DỮ LIỆU ĐỀ XUẤT

## Bảng chính

### admin_users
- id
- username
- password_hash
- role = ADMIN
- active
- created_at
- updated_at

### import_batches
- id
- original_filename
- checksum
- sheet_name
- total_rows
- valid_rows
- warning_rows
- error_rows
- imported_by
- created_at

### admission_records
- id
- import_batch_id
- source_row_number
- source_tt
- cccd_source
- full_name_source
- female_mark_source
- dob_source
- ethnicity_source
- residence_source
- middle_school_source
- middle_school_commune_source
- score fields
- note_source
- source_json
- data_quality_flags

### students
- id
- current_cccd
- current_dob
- status
- imported_at
- approved_at
- locked_at

### student_profile_values
- student_id
- field_code
- source_value
- proposed_value
- approved_value
- change_status
- updated_at

### student_profile_versions
- student_id
- version_number
- snapshot_json
- submitted_at
- approved_at

### student_access_sessions
- id
- student_id
- expires_at
- created_at

### addresses
- student_id
- address_type
- province_code
- province_name_snapshot
- commune_code
- commune_name_snapshot
- hamlet
- detailed_text

### family_members
- student_id
- type: FATHER/MOTHER/GUARDIAN
- absent_or_deceased
- full_name
- birth_year
- occupation
- phone
- email
- cccd

### policy_records
- student_id
- has_policy
- description
- policy_regime
- verified

### disabilities
- student_id
- has_disability
- disability_type
- not_assessed

### files
- id
- student_id
- category
- storage_key
- original_name
- mime
- size
- checksum
- width
- height
- current_version
- status

### qr_scan_results
- file_id
- card_side
- raw_payload
- parsed_json
- success
- created_at

### ocr_results
- file_id
- engine
- raw_text
- parsed_json
- confidence
- created_at

### photo_scan_results
- file_id
- valid
- warning_codes
- metrics_json
- created_at

### export_jobs
- id
- type
- status
- progress
- output_key
- error_report_key
- created_by
- created_at
- completed_at

### audit_logs
- actor_type
- actor_id
- action
- entity_type
- entity_id
- before_json
- after_json
- created_at
