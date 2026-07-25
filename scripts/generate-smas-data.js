const xlsx = require('xlsx');
const fs = require('fs');

const wbAddr = xlsx.readFile('D:\\HE THONG TUYEN SINH\\Danh_muc_dia_chi_cu_moi_toan_quoc(1).xlsx');
const sheetAddr = wbAddr.Sheets[wbAddr.SheetNames[0]];
const dataAddr = xlsx.utils.sheet_to_json(sheetAddr, { header: 1 });
const rows = dataAddr.slice(1);

const provinces = new Set();
const communesByProvince = {}; 

rows.forEach(row => {
  const oldDistrict = row[3];
  const newProvCode = row[6];
  const newProvName = row[7];
  const newCommuneCode = row[8];
  const newCommuneName = row[9];

  if (!newProvName || !newCommuneName) return;
  
  const formattedProv = `${String(newProvName).trim()} (${String(newProvCode).trim().padStart(2, '0')})`;
  const formattedCommune = `${String(newCommuneName).trim()} (${String(newCommuneCode).trim().padStart(5, '0')})`;
  const formattedDistrict = `${String(oldDistrict).trim()} (cũ)`;

  provinces.add(formattedProv);
  if (!communesByProvince[formattedProv]) {
    communesByProvince[formattedProv] = {};
  }
  if (!communesByProvince[formattedProv][formattedDistrict]) {
    communesByProvince[formattedProv][formattedDistrict] = new Set();
  }
  communesByProvince[formattedProv][formattedDistrict].add(formattedCommune);
});

const result = {
  provinces: Array.from(provinces).sort(),
  communes: {},
  ref: {}
};

for (const p of result.provinces) {
  result.communes[p] = {};
  for (const d in communesByProvince[p]) {
    result.communes[p][d] = Array.from(communesByProvince[p][d]).sort();
  }
}

const wbSmas = xlsx.readFile('00_INPUTS/02_MAU_XUAT_95_COT_SMAS_MOET.xlsx');
const refSheet = xlsx.utils.sheet_to_json(wbSmas.Sheets['ref'], {header: 1});
if (refSheet[0]) {
  refSheet[0].forEach((colName, i) => {
    if (colName) {
      result.ref[colName.trim()] = refSheet.slice(1).map(r => r[i]).filter(x => x).map(x => String(x).trim());
    }
  });
}

fs.writeFileSync('public/smas-data.json', JSON.stringify(result));
console.log('Done generating smas-data.json. Addresses loaded from the nationwide file with districts (cũ), other dropdowns from SMAS.');
