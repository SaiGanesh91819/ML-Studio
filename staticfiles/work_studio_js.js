document.addEventListener("DOMContentLoaded", function () {
    const fileInput = document.getElementById("fileInput");
    const uploadButton = document.getElementById("uploadButton");
    const fileInfo = document.getElementById("fileInfo");
    const fileName = document.getElementById("fileName");
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
    

    // Upload Button Logic
    uploadButton.addEventListener("click", () => {
        if (fileInput) {
            fileInput.click();
        } else {
            console.error("File input element not found!");
        }
    });

    // File Selection Logic
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const allowedExtensions = ["csv", "xls", "xlsx"];
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                alert("Invalid file type. Please upload a .csv, .xls, or .xlsx file.");
                return;
            }
            let formData = new FormData();
            formData.append("file", file);
            fetch("/work-studio/", {
                method: "POST",
                body: formData,
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.file_name) {
                    fileName.textContent = data.file_name;
                    fileInfo.style.display = "flex";
                    uploadButton.style.display = "none";
                } else if (data.error) {
                    alert("Upload failed: " + data.error);
                }
            })
            .catch(error => {
                console.error("Upload failed:", error);
                alert("File upload failed. Please try again.");
            });
        }
    });

    // Change File Logic
    changeFileButton.addEventListener("click", () => {
        fileInput.value = "";
        fileInfo.style.display = "none";
        uploadButton.style.display = "block";
        window.location.reload();
    });

    // Submit Button Logic
    submitButton.addEventListener("click", () => {
        submitButton.style.display = "none";
        fetch("/finalize-upload/", {
            method: "POST",
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
                "Content-Type": "application/json",
            },
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Error: ${data.error}`);
                return;
            }

            // Display Data Table
            const tableWrapper = document.createElement("div");
            tableWrapper.className = "table-wrapper";
            let tableHTML = '<table class="data-table">';
            tableHTML += '<thead><tr><th class="row-number-header">#</th>';
            data.columns.forEach(col => {
                tableHTML += `<th>${col}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';
            data.data.forEach((row, rowIndex) => {
                tableHTML += `<tr><td class="row-number">${rowIndex + 1}</td>`;
                data.columns.forEach((col, colIndex) => {
                    tableHTML += `<td data-col-index="${colIndex}">${row[colIndex]}</td>`; // Corrected line
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table>';
            tableWrapper.innerHTML = tableHTML;
            dataTableContainer.innerHTML = '';
            dataTableContainer.appendChild(tableWrapper);

            // Display Dataset Overview Statistics
            totalRowsElement.textContent = data.dataset_stats.total_rows;
            totalColumnsElement.textContent = data.dataset_stats.total_columns;

            // Populate Column Data Types
            columnTypesList.innerHTML = ''; // Clear previous content
            data.columns.forEach(col => {
                const colTypeInfo = document.createElement('p');
                const colDataType = data.column_stats[col] ? data.column_stats[col].data_type : 'N/A';
                colTypeInfo.innerHTML = `<span class="column-name">${col}:</span> <span class="column-data-type">${colDataType}</span>`;
                columnTypesList.appendChild(colTypeInfo);
            });

            // Populate Column Selector
            columnSelect.innerHTML = '<option value="">-- Select a Column --</option>';
            data.columns.forEach(col => {
                const option = document.createElement('option');
                option.value = col;
                option.textContent = col;
                columnSelect.appendChild(option);
            });

            // Column Selection Event Listener
            columnSelect.addEventListener('change', function() {
                const selectedCol = this.value;
                if (selectedCol && data.column_stats[selectedCol]) {
                    const stats = data.column_stats[selectedCol];
                    selectedColumnNameElement.textContent = selectedCol;
                    selectedColumnTypeElement.textContent = stats.data_type;
                    selectedColumnMissingElement.textContent = stats.missing_count;
                    selectedColumnMissingPctElement.textContent = stats.missing_percentage.toFixed(2);
                    selectedColumnUniqueElement.textContent = stats.unique_count;
                    selectedColumnUniquePctElement.textContent = stats.unique_percentage.toFixed(2);

                    // Hide all detailed stats sections initially
                    numericalStatsDiv.style.display = 'none';
                    categoricalStatsDiv.style.display = 'none';
                    booleanStatsDiv.style.display = 'none';
                    datetimeStatsDiv.style.display = 'none';

                    // Display relevant stats based on data type
                    if (stats.data_type.includes('int') || stats.data_type.includes('float')) {
                        numericalStatsDiv.style.display = 'block';
                        numericalMeanElement.textContent = stats.mean !== undefined ? stats.mean.toFixed(2) : 'N/A';
                        numericalMedianElement.textContent = stats.median !== undefined ? stats.median.toFixed(2) : 'N/A';
                        numericalStdDevElement.textContent = stats.std !== undefined ? stats.std.toFixed(2) : 'N/A';
                        numericalVarianceElement.textContent = stats.variance !== undefined ? stats.variance.toFixed(2) : 'N/A';
                        numericalMinElement.textContent = stats.min !== undefined && stats.min !== '' ? stats.min : 'N/A';
                        numericalMaxElement.textContent = stats.max !== undefined && stats.max !== '' ? stats.max : 'N/A';
                        numericalRangeElement.textContent = (stats.max !== undefined && stats.min !== undefined && stats.max !== '' && stats.min !== '') ? (stats.max - stats.min).toFixed(2) : 'N/A';
                        numericalIQRElement.textContent = stats.iqr !== undefined ? stats.iqr.toFixed(2) : 'N/A';
                        numericalSkewnessElement.textContent = stats.skewness !== undefined ? stats.skewness.toFixed(2) : 'N/A';
                        numericalKurtosisElement.textContent = stats.kurtosis !== undefined ? stats.kurtosis.toFixed(2) : 'N/A';
                        numericalQ1Element.textContent = stats.q1 !== undefined ? stats.q1.toFixed(2) : 'N/A';
                        numericalQ2Element.textContent = stats.q2 !== undefined ? stats.q2.toFixed(2) : 'N/A';
                        numericalQ3Element.textContent = stats.q3 !== undefined ? stats.q3.toFixed(2) : 'N/A';
                    } else if (stats.data_type === 'object') {
                        categoricalStatsDiv.style.display = 'block';
                        categoricalNumCategoriesElement.textContent = stats.num_categories;
                        topCategoriesDiv.innerHTML = '<h6>Top Categories</h6>';
                        if (stats.top_categories && stats.top_categories.length > 0) {
                            stats.top_categories.forEach(item => {
                                const p = document.createElement('p');
                                p.textContent = `${item.value}: ${item.count} (${item.percentage.toFixed(2)}%)`;
                                topCategoriesDiv.appendChild(p);
                            });
                        } else {
                            const p = document.createElement('p');
                            p.textContent = 'No frequent categories to display.';
                            topCategoriesDiv.appendChild(p);
                        }
                    } else if (stats.data_type === 'bool') {
                        booleanStatsDiv.style.display = 'block';
                        booleanTrueCountElement.textContent = stats.true_count;
                        booleanFalseCountElement.textContent = stats.false_count;
                        booleanTruePctElement.textContent = stats.true_percentage.toFixed(2);
                        booleanFalsePctElement.textContent = stats.false_percentage.toFixed(2);
                    } else if (stats.data_type.includes('datetime')) {
                        datetimeStatsDiv.style.display = 'block';
                        datetimeEarliestElement.textContent = stats.earliest || 'N/A';
                        datetimeLatestElement.textContent = stats.latest || 'N/A';
                        datetimeRangeElement.textContent = stats.range ? (stats.range / 3600).toFixed(2) + ' hours' : 'N/A'; // Display range in hours
                    }

                    selectedColumnStats.style.display = 'block';
                } else {
                    selectedColumnStats.style.display = 'none';
                }
            });

            workArena.style.display = "flex";
            addSelectionListeners();
        })
        .catch(error => {
            console.error("Error finalizing upload:", error);
            alert("Something went wrong while processing the file.");
        });
    });

    function addSelectionListeners() {
        const table = document.querySelector(".data-table");
        if (!table) return;

        // Row selection logic
        table.querySelectorAll(".row-number").forEach((rowHeader, rowIndex) => {
            rowHeader.addEventListener("click", () => {
                table.querySelectorAll("tr").forEach((tr, index) => {
                    if (index === rowIndex + 1) { // Select only the intended row
                        tr.classList.toggle("selected-row");
                    } else {
                        tr.classList.remove("selected-row");
                    }
                });
            });
        });

        // Column selection logic
        table.querySelectorAll("th").forEach((header, colIndex) => {
            const isHeaderColumn = colIndex === 0; // Skip row number column
            if (isHeaderColumn) return;

            header.addEventListener("click", () => {
                table.querySelectorAll("td").forEach((cell) => {
                    if (parseInt(cell.getAttribute("data-col-index")) === colIndex - 1) {
                        cell.classList.toggle("selected-column");
                    } else {
                        cell.classList.remove("selected-column");
                    }
                });

                table.querySelectorAll("th").forEach((th, index) => {
                    if (index === colIndex) {
                        th.classList.toggle("selected-column");
                    } else {
                        th.classList.remove("selected-column");
                    }
                });
            });
        });
    }
});