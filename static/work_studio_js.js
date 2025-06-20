document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const uploadButton = document.getElementById("uploadButton");
  const fileInfo = document.getElementById("fileInfo");
  const fileNameElement = document.getElementById("fileName");
  const changeFileButton = document.getElementById("changeFileButton");
  const submitButton = document.getElementById("submitButton");
  const dataTableContainer = document.getElementById("dataTable");
  const workArena = document.getElementById("workArena");
  const totalRowsElement = document.getElementById("totalRows");
  const totalColumnsElement = document.getElementById("totalColumns");
  const columnSelect = document.getElementById("columnSelect");
  const selectedColumnStats = document.getElementById("selectedColumnStats");
  const selectedColumnNameElement = document.getElementById("selectedColumnName");
  const selectedColumnTypeElement = document.getElementById("selectedColumnType");
  const selectedColumnMissingElement = document.getElementById("selectedColumnMissing");
  const selectedColumnMissingPctElement = document.getElementById("selectedColumnMissingPct");
  const selectedColumnUniqueElement = document.getElementById("selectedColumnUnique");
  const selectedColumnUniquePctElement = document.getElementById("selectedColumnUniquePct");
  const numericalStatsDiv = document.getElementById("numericalStats");
  const categoricalStatsDiv = document.getElementById("categoricalStats");
  const booleanStatsDiv = document.getElementById("booleanStats");
  const datetimeStatsDiv = document.getElementById("datetimeStats");
  const numericalMeanElement = document.getElementById("numericalMean");
  const numericalMedianElement = document.getElementById("numericalMedian");
  const numericalStdDevElement = document.getElementById("numericalStdDev");
  const numericalVarianceElement = document.getElementById("numericalVariance");
  const numericalMinElement = document.getElementById("numericalMin");
  const numericalMaxElement = document.getElementById("numericalMax");
  const numericalRangeElement = document.getElementById("numericalRange");
  const numericalIQRElement = document.getElementById("numericalIQR");
  const numericalSkewnessElement = document.getElementById("numericalSkewness");
  const numericalKurtosisElement = document.getElementById("numericalKurtosis");
  const numericalQ1Element = document.getElementById("numericalQ1");
  const numericalQ2Element = document.getElementById("numericalQ2");
  const numericalQ3Element = document.getElementById("numericalQ3");
  const categoricalNumCategoriesElement = document.getElementById("categoricalNumCategories");
  const topCategoriesDiv = document.getElementById("topCategories");
  const booleanTrueCountElement = document.getElementById("booleanTrueCount");
  const booleanFalseCountElement = document.getElementById("booleanFalseCount");
  const booleanTruePctElement = document.getElementById("booleanTruePct");
  const booleanFalsePctElement = document.getElementById("booleanFalsePct");
  const datetimeEarliestElement = document.getElementById("datetimeEarliest");
  const datetimeLatestElement = document.getElementById("datetimeLatest");
  const datetimeRangeElement = document.getElementById("datetimeRange");
  const columnTypesList = document.getElementById("columnTypesList");
  const outerOptions = document.querySelectorAll('.outer-options');
  const subOptionsContainer = document.querySelector('.sub-options-container');
  const subOptionsDisplayArea = document.querySelector('.sub-options-display-area');
  const subStatsContainer = document.querySelector('.sub-stats-container');
  const correlationOutputDiv = document.getElementById("correlationOutput");
  const successAudio = document.getElementById("successSound");
  const postProcessingActionsDiv = document.getElementById("postProcessingActions");
  const downloadBtn = document.getElementById("downloadButton");
  const proceedBtn = document.getElementById("proceedButton");
  const dataStatistics = document.getElementById('dataStatistics');
  const shiningBall = document.querySelector('.shining-ball');

  let columnStats = null;
  let currentColumns = [];
  let currentActiveButton = null;
  let currentActiveSection = null;

  function initEventListeners() {
    uploadButton?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", handleFileChange);
    changeFileButton?.addEventListener("click", () => window.location.reload());
    submitButton?.addEventListener("click", handleFinalizeUpload);
    columnSelect?.addEventListener('change', handleColumnSelectChange);
    outerOptions.forEach(button => button.addEventListener('click', handleOuterOptionClick));
    proceedBtn?.addEventListener('click', handleProceedClick);
    startOriginalGlowAnimation();
  }

  function handleFileChange() {
    if (!fileInput || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    const allowedExtensions = ["csv", "xls", "xlsx"];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      alert("Invalid file type.");
      fileInput.value = "";
      return;
    }
    let formData = new FormData();
    formData.append("file", file);
    fetch("/work-studio/", { method: "POST", body: formData })
      .then(handleFetchResponse)
      .then(data => {
        if (data.file_name && fileNameElement && fileInfo && uploadButton && submitButton) {
          fileNameElement.textContent = data.file_name;
          fileInfo.style.display = "flex";
          uploadButton.style.display = "none";
          submitButton.style.display = "inline-block";
        } else if (data.error) {
          alert("Upload failed: " + data.error);
          fileInput.value = "";
        }
      })
      .catch(handleFetchError("File upload failed"));
  }

  function handleFinalizeUpload() {
    if (!submitButton) return;
    submitButton.disabled = true;
    submitButton.textContent = "Processing...";
    fetch("/finalize-upload/", {
      method: "POST",
      headers: { "X-CSRFToken": getCsrfToken(), "Content-Type": "application/json" }
    })
      .then(handleFetchResponse)
      .then(data => {
        if (data.error) throw new Error(data.error);
        submitButton.style.display = "none";
        updateUIWithData(data);
        if (workArena) workArena.style.display = "flex";
        if (postProcessingActionsDiv) postProcessingActionsDiv.style.display = "flex";
        if (downloadBtn) downloadBtn.href = '/download-preprocessed/';
      })
      .catch(error => {
        handleFetchError("Error processing file")(error);
        submitButton.disabled = false;
        submitButton.textContent = "Submit";
      });
  }

  function handleColumnSelectChange(event) {
    const selectedCol = event.target.value;
    if (selectedCol && columnStats && columnStats[selectedCol]) {
      updateColumnStatsDisplay(selectedCol);
    } else if (selectedColumnStats) {
      selectedColumnStats.style.display = 'none';
    }
  }

  function handleOuterOptionClick(event) {
    const button = event.currentTarget;
    const targetId = button.getAttribute('data-target');
    const buttonText = button.textContent.trim();
    if (currentActiveButton) currentActiveButton.classList.remove('active-option');
    button.classList.add('active-option');
    currentActiveButton = button;
    if (currentActiveSection) {
      currentActiveSection.remove();
      currentActiveSection = null;
    }
    if (correlationOutputDiv) correlationOutputDiv.innerHTML = '';
    displayPreprocessingOptions(targetId, buttonText);
  }

  function handleInnerOptionClick(event, sectionData) {
    const { targetId, columnSelector, minMaxInputsContainer, clonedSubOptions } = sectionData;
    const clickedOption = event.currentTarget;
    clonedSubOptions.querySelectorAll('.inner-options').forEach(opt => opt.classList.remove('active'));
    clickedOption.classList.add('active');
    const subOptionText = clickedOption.textContent.trim();

    if (columnSelector) columnSelector.style.display = 'none';
    if (minMaxInputsContainer) minMaxInputsContainer.style.display = 'none';

    let filterType = 'none';
    if (targetId === 'hmv' && ['Fill with Mean', 'Fill with Median'].includes(subOptionText)) filterType = 'numeric';
    else if (targetId === 'hmv' && subOptionText === 'Fill with Mode') filterType = 'all';
    else if (targetId === 'rd' && subOptionText === 'Remove Duplicates (Specific Columns)') filterType = 'all';
    else if (targetId === 'n') filterType = 'numeric';
    else if (targetId === 'ecd') filterType = 'categorical';
    else if (targetId === 'fdc') filterType = 'text';

    if (filterType !== 'none' && columnSelector) {
      populateColumnSelector(columnSelector, filterType);
      columnSelector.style.display = 'block';
      // Add instruction for normalization
      if (targetId === 'norm') {
        const instruction = document.createElement('p');
        instruction.textContent = 'Select at least one numeric column to normalize.';
        instruction.style.color = 'red';
        instruction.style.marginTop = '5px';
        columnSelector.parentNode.insertBefore(instruction, columnSelector.nextSibling);
      }
    }
    if (targetId === 'norm' && subOptionText === 'Min-Max Normalization' && minMaxInputsContainer) {
      minMaxInputsContainer.style.display = 'flex';
    }
  }

  function handleProceedClick() {
    window.location.href = '/model-training/';
  }

  function displayPreprocessingOptions(targetId, buttonText) {
    if (!subOptionsDisplayArea || !subOptionsContainer) {
      console.error("Display area or sub-options container not found");
      return;
    }
    const targetSubOptions = subOptionsContainer.querySelector(`.sub-options.${targetId}`);
    const newSection = document.createElement('div');
    newSection.classList.add('active-sub-options');
    const heading = document.createElement('h3');
    heading.textContent = buttonText;
    newSection.appendChild(heading);
    let columnSelector = null;
    let minMaxInputsContainer = null;

    if (targetSubOptions) {
      const clonedSubOptions = targetSubOptions.cloneNode(true);
      clonedSubOptions.style.display = 'flex';
      newSection.appendChild(clonedSubOptions);
      const needsMultiSelect = ['rd', 'n', 'hmv'].includes(targetId);
      const needsSingleSelect = ['fdc', 'ecd'].includes(targetId);
      if (needsMultiSelect || needsSingleSelect) {
        columnSelector = document.createElement('select');
        columnSelector.multiple = needsMultiSelect;
        columnSelector.className = 'column-selector';
        columnSelector.id = `columnSelector-${targetId}`; // Unique ID for each section
        columnSelector.style.display = 'none';
        columnSelector.innerHTML = `<option value="">Select column${needsMultiSelect ? '(s)' : ''}</option>`;
        newSection.appendChild(columnSelector);
      }
      if (targetId === 'n') {
        minMaxInputsContainer = document.createElement('div');
        minMaxInputsContainer.className = 'min-max-inputs';
        minMaxInputsContainer.style.display = 'none';
        minMaxInputsContainer.innerHTML = `
          <label>Min: <input type="number" name="min_range" value="0" step="any"></label>
          <label>Max: <input type="number" name="max_range" value="1" step="any"></label>`;
        if (columnSelector) {
          columnSelector.insertAdjacentElement('afterend', minMaxInputsContainer);
        } else {
          newSection.appendChild(minMaxInputsContainer);
        }
      }
      const applyButton = createApplyButton(newSection, buttonText, targetId, minMaxInputsContainer);
      newSection.appendChild(applyButton);
      clonedSubOptions.querySelectorAll('.inner-options').forEach(option => {
        option.addEventListener('click', (e) => handleInnerOptionClick(e, { targetId, columnSelector, minMaxInputsContainer, clonedSubOptions }));
      });
    } else if (targetId === 'ca') {
      const applyButton = createApplyButton(newSection, buttonText, targetId, null);
      applyButton.textContent = 'Run Analysis';
      newSection.appendChild(applyButton);
    } else {
      console.warn(`No sub-options found or defined for targetId='${targetId}'`);
    }
    subOptionsDisplayArea.innerHTML = '';
    subOptionsDisplayArea.appendChild(newSection);
    currentActiveSection = newSection;
  }

  function createApplyButton(sectionElement, optionText, targetId, minMaxInputsContainer) {
    const applyButton = document.createElement('button');
    applyButton.className = 'apply-button';
    applyButton.textContent = 'Apply';
    applyButton.addEventListener('click', () => submitPreprocessing(sectionElement, optionText, targetId, minMaxInputsContainer));
    return applyButton;
  }

  function submitPreprocessing(sectionElement, optionText, targetId, minMaxInputsContainer) {
    const selectedSubOptionElement = sectionElement.querySelector('.inner-options.active');
    const subOptionText = selectedSubOptionElement ? selectedSubOptionElement.textContent.trim() : null;
    if (!subOptionText && targetId !== 'ca') {
      alert('Please select a sub-option first.');
      return;
    }
    const formData = buildFormData(sectionElement, optionText, targetId, subOptionText, minMaxInputsContainer);
    if (!formData) return;
    const confirmMsg = subOptionText ? `Apply ${subOptionText}?` : `Run ${optionText}?`;
    if (confirm(confirmMsg)) {
      handleFetchApply(formData, sectionElement, optionText);
    }
  }

  function buildFormData(sectionElement, optionText, targetId, subOptionText, minMaxInputsContainer) {
    const formData = new FormData();
    formData.append('option', optionText);
    formData.append('sub_option', subOptionText || optionText);
    const columnSelector = sectionElement.querySelector(`#columnSelector-${targetId}`);
    let selectedCols = [];
    if (columnSelector && columnSelector.style.display === 'block') {
      if (columnSelector.multiple) {
        selectedCols = Array.from(columnSelector.selectedOptions).map(opt => opt.value).filter(val => val);
      } else {
        selectedCols = columnSelector.value ? [columnSelector.value] : [];
      }
      const requiresColumns = ['hmv', 'rd', 'norm'].includes(targetId) && subOptionText !== 'Drop Rows' && subOptionText !== 'Remove All Duplicates';
      const requiresSingleColumn = ['fdc', 'ecd'].includes(targetId);
      if (requiresColumns && selectedCols.length === 0) {
        alert('Please select at least one column for this operation.');
        return null;
      }
      if (requiresSingleColumn && selectedCols.length !== 1) {
        alert('Please select exactly one column for this operation.');
        return null;
      }
      if (requiresSingleColumn) {
        formData.append('column', selectedCols[0]);
      } else if (selectedCols.length > 0) {
        formData.append('columns', selectedCols.join(','));
      }
    }
    if (targetId === 'norm' && subOptionText === 'Min-Max Normalization' && minMaxInputsContainer && minMaxInputsContainer.style.display === 'flex') {
      const minInput = minMaxInputsContainer.querySelector('input[name="min_range"]');
      const maxInput = minMaxInputsContainer.querySelector('input[name="max_range"]');
      const minVal = minInput ? minInput.value : '0';
      const maxVal = maxInput ? maxInput.value : '1';
      if (minVal === '' || maxVal === '' || isNaN(parseFloat(minVal)) || isNaN(parseFloat(maxVal)) || parseFloat(minVal) >= parseFloat(maxVal)) {
        alert('Enter valid Min < Max range.');
        return null;
      }
      formData.append('min_range', minVal);
      formData.append('max_range', maxVal);
    }
    return formData;
  }

  function handleFetchApply(formData, sectionElement, optionText) {
    const applyButton = sectionElement.querySelector('.apply-button');
    const buttonTextContent = optionText === 'Correlation Analysis' ? 'Run Analysis' : 'Apply';
    if (applyButton) {
      applyButton.disabled = true;
      applyButton.textContent = "Applying...";
    }
    fetch('/apply-preprocessing/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfToken() },
      body: formData
    })
      .then(handleFetchResponse)
      .then(data => {
        if (data.error) throw new Error(data.error);
        alert(data.action_summary || `Operation successful.`);
        if (optionText !== 'Correlation Analysis') {
          updateUIWithData(data, true);
        } else {
          if (data.correlation_matrix) {
            displayCorrelationMatrix(data.correlation_matrix);
          } else {
            if (correlationOutputDiv) correlationOutputDiv.innerHTML = '<p>Could not generate correlation matrix.</p>';
          }
          preprocessingStats = data.preprocessing_stats;
          columnStats = data.column_stats;
          triggerSuccessEffect();
        }
        if (applyButton) {
          applyButton.disabled = false;
          applyButton.textContent = buttonTextContent;
        }
      })
      .catch(error => {
        handleFetchError('Failed preprocessing')(error);
        if (applyButton) {
          applyButton.disabled = false;
          applyButton.textContent = buttonTextContent;
        }
      });
  }

  function updateUIWithData(data, operationSuccess = false) {
    preprocessingStats = data.preprocessing_stats;
    columnStats = data.column_stats;
    currentColumns = data.columns;
    currentData = data.data;
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "table-wrapper";
    let tableHTML = '<table class="data-table"><thead><tr><th class="row-number-header">#</th>';
    (currentColumns || []).forEach(col => tableHTML += `<th>${col}</th>`);
    tableHTML += '</tr></thead><tbody>';
    (currentData || []).forEach((row, rowIndex) => {
      tableHTML += `<tr><td class="row-number">${rowIndex + 1}</td>`;
      (currentColumns || []).forEach((col, colIndex) => {
        const cellValue = row[colIndex] !== undefined && row[colIndex] !== null ? row[colIndex] : '';
        tableHTML += `<td data-col-index="${colIndex}">${cellValue}</td>`;
      });
      tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    tableWrapper.innerHTML = tableHTML;
    dataTableContainer.innerHTML = '';
    dataTableContainer.appendChild(tableWrapper);
    if (data.dataset_stats) {
      totalRowsElement.textContent = data.dataset_stats.total_rows;
      totalColumnsElement.textContent = data.dataset_stats.total_columns;
    }
    columnTypesList.innerHTML = '';
    (currentColumns || []).forEach(col => {
      const colTypeInfo = document.createElement('p');
      const colDataType = columnStats && columnStats[col] ? columnStats[col].data_type : 'N/A';
      colTypeInfo.innerHTML = `<span class="column-name">${col}:</span> <span class="column-data-type">${colDataType}</span>`;
      columnTypesList.appendChild(colTypeInfo);
    });
    columnSelect.innerHTML = '<option value="">-- Select Column for Stats --</option>';
    (currentColumns || []).forEach(col => {
      const option = document.createElement('option');
      option.value = col;
      option.textContent = col;
      columnSelect.appendChild(option);
    });
    if (selectedColumnStats) selectedColumnStats.style.display = 'none';
    if (correlationOutputDiv && !data.correlation_matrix) correlationOutputDiv.innerHTML = '';
    addSelectionListeners();
    if (operationSuccess) triggerSuccessEffect();
    if (postProcessingActionsDiv) postProcessingActionsDiv.style.display = "flex";
    if (downloadBtn) downloadBtn.href = '/download-preprocessed/';
  }

  function triggerSuccessEffect() {
    const targetElement = dataStatistics || document.body;
    targetElement.classList.add('preprocessing-success');
    if (successAudio) {
      successAudio.currentTime = 0;
      successAudio.play().catch(e => console.error("Audio play failed:", e));
    }
    setTimeout(() => targetElement.classList.remove('preprocessing-success'), 3500);
  }

  function populateColumnSelector(selectorElement, columnTypeFilter) {
    if (!selectorElement || !columnStats || !currentColumns) {
      console.error("Cannot populate selector: Missing data");
      return;
    }
    selectorElement.innerHTML = `<option value="">Select column${selectorElement.multiple ? '(s)' : ''}</option>`;
    currentColumns.forEach(colName => {
      if (!columnStats[colName]) return;
      const dtype = columnStats[colName].data_type || '';
      let includeColumn = false;
      switch (columnTypeFilter) {
        case 'numeric':
          includeColumn = dtype.includes('int') || dtype.includes('float') || dtype.includes('number');
          break;
        case 'categorical':
          includeColumn = dtype === 'object' || dtype.includes('category') || dtype === 'bool';
          break;
        case 'text':
          includeColumn = dtype === 'object' || dtype.includes('string');
          break;
        case 'all':
        default:
          includeColumn = true;
          break;
      }
      if (includeColumn) {
        const option = document.createElement('option');
        option.value = colName;
        option.textContent = colName;
        selectorElement.appendChild(option);
      }
    });
  }

  function displayCorrelationMatrix(matrixData) {
    if (!correlationOutputDiv) {
      console.error("#correlationOutput not found");
      return;
    }
    correlationOutputDiv.innerHTML = '';
    if (!matrixData || typeof matrixData !== 'object') {
      correlationOutputDiv.innerHTML = '<p>Invalid correlation data.</p>';
      return;
    }
    if (matrixData.error) {
      correlationOutputDiv.innerHTML = `<p class="error">Error: ${matrixData.error}</p>`;
      return;
    }
    if (matrixData.message) {
      correlationOutputDiv.innerHTML = `<p>${matrixData.message}</p>`;
      return;
    }
    const columns = Object.keys(matrixData);
    if (columns.length === 0) {
      correlationOutputDiv.innerHTML = '<p>No correlation data.</p>';
      return;
    }
    let tableHTML = '<h4>Correlation Matrix</h4><table class="correlation-table"><thead><tr><th></th>';
    columns.forEach(col => tableHTML += `<th>${col}</th>`);
    tableHTML += '</tr></thead><tbody>';
    columns.forEach(rowCol => {
      tableHTML += `<tr><th>${rowCol}</th>`;
      columns.forEach(colCol => {
        const value = (matrixData[rowCol] && matrixData[rowCol][colCol] !== undefined && matrixData[rowCol][colCol] !== null)
          ? parseFloat(matrixData[rowCol][colCol]).toFixed(2)
          : 'N/A';
        let tdClass = '';
        if (rowCol === colCol) tdClass = 'corr-diagonal';
        else if (!isNaN(parseFloat(value))) {
          if (Math.abs(parseFloat(value)) >= 0.7) tdClass = 'corr-strong';
          else if (Math.abs(parseFloat(value)) <= 0.3) tdClass = 'corr-weak';
        }
        tableHTML += `<td class="${tdClass}">${value}</td>`;
      });
      tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    correlationOutputDiv.innerHTML = tableHTML;
  }

  function updateColumnStatsDisplay(selectedCol) {
    const stats = columnStats ? columnStats[selectedCol] : null;
    if (!stats || !selectedColumnStats) {
      if (selectedColumnStats) selectedColumnStats.style.display = 'none';
      return;
    }
    if (selectedColumnNameElement) selectedColumnNameElement.textContent = selectedCol;
    if (selectedColumnTypeElement) selectedColumnTypeElement.textContent = stats.data_type || 'N/A';
    if (selectedColumnMissingElement) selectedColumnMissingElement.textContent = stats.missing_count ?? 'N/A';
    if (selectedColumnMissingPctElement) selectedColumnMissingPctElement.textContent = stats.missing_percentage?.toFixed(2) ?? 'N/A';
    if (selectedColumnUniqueElement) selectedColumnUniqueElement.textContent = stats.unique_count ?? 'N/A';
    if (selectedColumnUniquePctElement) selectedColumnUniquePctElement.textContent = stats.unique_percentage?.toFixed(2) ?? 'N/A';

    if (numericalStatsDiv) numericalStatsDiv.style.display = 'none';
    if (categoricalStatsDiv) categoricalStatsDiv.style.display = 'none';
    if (booleanStatsDiv) booleanStatsDiv.style.display = 'none';
    if (datetimeStatsDiv) datetimeStatsDiv.style.display = 'none';

    const dtype = stats.data_type || '';
    if (dtype.includes('int') || dtype.includes('float') || dtype.includes('number')) {
      if (numericalStatsDiv) numericalStatsDiv.style.display = 'block';
      if (numericalMeanElement) numericalMeanElement.textContent = stats.mean?.toFixed(2) ?? 'N/A';
      if (numericalMedianElement) numericalMedianElement.textContent = stats.median?.toFixed(2) ?? 'N/A';
      if (numericalStdDevElement) numericalStdDevElement.textContent = stats.std?.toFixed(2) ?? 'N/A';
      if (numericalVarianceElement) numericalVarianceElement.textContent = stats.variance?.toFixed(2) ?? 'N/A';
      if (numericalMinElement) numericalMinElement.textContent = stats.min?.toFixed(2) ?? 'N/A';
      if (numericalMaxElement) numericalMaxElement.textContent = stats.max?.toFixed(2) ?? 'N/A';
      if (numericalRangeElement) numericalRangeElement.textContent = stats.range?.toFixed(2) ?? 'N/A';
      if (numericalIQRElement) numericalIQRElement.textContent = stats.iqr?.toFixed(2) ?? 'N/A';
      if (numericalSkewnessElement) numericalSkewnessElement.textContent = stats.skewness?.toFixed(2) ?? 'N/A';
      if (numericalKurtosisElement) numericalKurtosisElement.textContent = stats.kurtosis?.toFixed(2) ?? 'N/A';
      if (numericalQ1Element) numericalQ1Element.textContent = stats.q1?.toFixed(2) ?? 'N/A';
      if (numericalQ2Element) numericalQ2Element.textContent = stats.q2?.toFixed(2) ?? 'N/A';
      if (numericalQ3Element) numericalQ3Element.textContent = stats.q3?.toFixed(2) ?? 'N/A';
    } else if (dtype === 'object' || dtype.includes('category')) {
      if (categoricalStatsDiv) categoricalStatsDiv.style.display = 'block';
      if (categoricalNumCategoriesElement) categoricalNumCategoriesElement.textContent = stats.num_categories ?? 'N/A';
      if (topCategoriesDiv) {
        topCategoriesDiv.innerHTML = '<h6>Top Categories</h6>';
        if (stats.top_categories && stats.top_categories.length > 0) {
          stats.top_categories.forEach(item => {
            const p = document.createElement('p');
            const value = item.value ?? 'N/A';
            const count = item.count ?? 'N/A';
            const percentage = item.percentage?.toFixed(2) ?? 'N/A';
            p.textContent = `${value}: ${count} (${percentage}%)`;
            topCategoriesDiv.appendChild(p);
          });
        } else {
          topCategoriesDiv.innerHTML += '<p>No frequent categories.</p>';
        }
      }
    } else if (dtype === 'bool'|| dtype === 'boolean') {
      if (booleanStatsDiv) booleanStatsDiv.style.display = 'block';
        if (booleanTrueCountElement) booleanTrueCountElement.textContent = stats.true_count ?? 'N/A';
        if (booleanFalseCountElement) booleanFalseCountElement.textContent = stats.false_count ?? 'N/A';
        if (booleanTruePctElement) booleanTruePctElement.textContent = 
            stats.true_percentage !== undefined ? stats.true_percentage.toFixed(2) : 'N/A';
        if (booleanFalsePctElement) booleanFalsePctElement.textContent = 
            stats.false_percentage !== undefined ? stats.false_percentage.toFixed(2) : 'N/A';
    } else if (dtype.includes('datetime')) {
      if (datetimeStatsDiv) datetimeStatsDiv.style.display = 'block';
      if (datetimeEarliestElement) datetimeEarliestElement.textContent = stats.earliest || 'N/A';
      if (datetimeLatestElement) datetimeLatestElement.textContent = stats.latest || 'N/A';
      if (datetimeRangeElement) {
        datetimeRangeElement.textContent = stats.range_seconds !== undefined && stats.range_seconds !== null
          ? (stats.range_seconds / 3600).toFixed(2) + ' hours'
          : 'N/A';
      }
    }
    if (selectedColumnStats) selectedColumnStats.style.display = 'block';
  }

  function handleFetchResponse(response) {
    if (!response.ok) {
      return response.json().catch(() => {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }).then(err => {
        throw new Error(err.error || `HTTP error! Status: ${response.status}`);
      });
    }
    return response.json();
  }

  function handleFetchError(prefix = "Error") {
    return function(error) {
      console.error(`${prefix}:`, error);
      alert(`${prefix}: ${error.message}`);
    };
  }

  function getCsrfToken() {
    const csrfElement = document.querySelector("[name=csrfmiddlewaretoken]");
    return csrfElement ? csrfElement.value : "";
  }

  function addSelectionListeners() {
    const table = dataTableContainer.querySelector(".data-table");
    if (!table) {
      console.error("Data table not found for adding selection listeners.");
      return;
    }
    table.querySelectorAll("tbody .row-number").forEach(rowHeader => {
      rowHeader.addEventListener("click", () => {
        const parentRow = rowHeader.closest('tr');
        if (!parentRow) return;
        const currentlySelected = parentRow.classList.contains("selected-row");
        table.querySelectorAll("tbody tr").forEach(tr => tr.classList.remove("selected-row"));
        if (!currentlySelected) {
          parentRow.classList.add("selected-row");
        }
      });
    });
    table.querySelectorAll("thead th").forEach((header, colIndex) => {
      if (colIndex === 0) return;
      header.addEventListener("click", () => {
        const currentlySelected = header.classList.contains("selected-column");
        table.querySelectorAll("th, td").forEach(el => el.classList.remove("selected-column"));
        if (!currentlySelected) {
          header.classList.add("selected-column");
          table.querySelectorAll(`td[data-col-index="${colIndex - 1}"]`).forEach(cell => {
            if (cell) cell.classList.add("selected-column");
          });
        }
      });
    });
  }

  function startOriginalGlowAnimation() {
    if (shiningBall && dataStatistics) {
      const updateGlow = () => {
        try {
          const currentTime = performance.now();
          let animationDuration = 1000;
          const animationDurationStyle = getComputedStyle(shiningBall).animationDuration;
          if (animationDurationStyle && animationDurationStyle.includes('s')) {
            animationDuration = parseFloat(animationDurationStyle) * 1000;
          } else if (animationDurationStyle && animationDurationStyle.includes('ms')) {
            animationDuration = parseFloat(animationDurationStyle);
          }
          if (animationDuration <= 0 || !isFinite(animationDuration)) animationDuration = 1000;
          const normalizedTime = (currentTime % animationDuration) / animationDuration;
          let glowIntensity = 0;
          let glowOpacity = 0;
          const factor = Math.max(0.01, (0.2 / (animationDuration / 1000)));
          const lowerBound = 0.7 + factor;
          const upperBound = 1.0;
          const midRange = 0.3 - factor;
          const lowerBoundAlt = 0.0;
          const upperBoundAlt = 0.3;
          const midRangeAlt = 0.3;

          if (normalizedTime > lowerBound && midRange > 0) {
            const proximityToBottom = Math.max(0, Math.min(1, (normalizedTime - lowerBound) / midRange));
            glowIntensity = Math.round(proximityToBottom * 150);
            glowOpacity = 0.7 + proximityToBottom * 0.3;
          } else if (normalizedTime < upperBoundAlt && midRangeAlt > 0) {
            const proximityToTop = Math.max(0, Math.min(1, 1 - (normalizedTime / midRangeAlt)));
            glowIntensity = Math.round(proximityToTop * 75);
            glowOpacity = 0.6 + proximityToTop * 0.4;
          }
          if (dataStatistics) {
            dataStatistics.style.boxShadow = `0 0 ${glowIntensity}px rgba(158, 158, 158, ${Math.max(0.4, glowOpacity)})`;
          }
        } catch (e) {
          console.error("Error in updateGlow:", e);
          return;
        }
        requestAnimationFrame(updateGlow);
      };
      requestAnimationFrame(updateGlow);
    } else {
      console.log('Shining ball or data statistics element not found!');
    }
  }

  initEventListeners();
}); 