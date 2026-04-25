import * as XLSX from 'xlsx';

/**
 * Reusable utility to export data to an Excel (.xlsx) file.
 * 
 * @param {Array} data - The array of objects to export
 * @param {string} sheetName - The name of the worksheet
 * @param {string} fileName - The name of the file (e.g. 'export.xlsx')
 */
export const exportToExcel = (data, sheetName, fileName) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
};

/**
 * Reusable utility to export multiple datasets into separate sheets within one Excel file.
 * 
 * @param {Array} sheets - Array of objects: { data: Array, sheetName: string }
 * @param {string} fileName - The name of the file
 */
export const exportMultipleToExcel = (sheets, fileName) => {
  const workbook = XLSX.utils.book_new();
  
  sheets.forEach(({ data, sheetName }) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });
  
  XLSX.writeFile(workbook, fileName);
};

/**
 * Filter an array of records by date range safely.
 * 
 * @param {Array} records - Array of records
 * @param {string} dateField - The property name containing the date string (e.g. 'join_date', 'date')
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Array} Filtered records
 */
export const filterByDateRange = (records, dateField, startDate, endDate) => {
  if (!startDate || !endDate) return records;
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  return records.filter(record => {
    let recordDateStr = record[dateField];
    
    // Fallback to created_at if the primary date field is missing
    if (!recordDateStr && record.created_at) {
      recordDateStr = record.created_at;
    }
    
    if (!recordDateStr) return false;
    
    const recordDate = new Date(recordDateStr);
    return recordDate >= start && recordDate <= end;
  });
};
