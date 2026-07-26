/* eslint-disable @typescript-eslint/no-require-imports */
const xlsx = require('xlsx');
const fs = require('fs');

const wb = xlsx.readFile('D:\\HE THONG TUYEN SINH\\Danh_muc_dia_chi_cu_moi_toan_quoc(1).xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

// skip header
const rows = data.slice(1);

const provinces = new Set();
const communesByProvince = {}; 

rows.forEach(row => {
  const oldDistrict = row[3];
  const newProvince = row[7];
  const newCommune = row[9];

  if (!newProvince || !newCommune) return;

  provinces.add(newProvince);
  if (!communesByProvince[newProvince]) {
    communesByProvince[newProvince] = {};
  }
  if (!communesByProvince[newProvince][oldDistrict]) {
    communesByProvince[newProvince][oldDistrict] = new Set();
  }
  communesByProvince[newProvince][oldDistrict].add(newCommune);
});

const result = {
  provinces: Array.from(provinces).sort(),
  communes: {}
};

for (const p of result.provinces) {
  result.communes[p] = {};
  for (const d in communesByProvince[p]) {
    result.communes[p][d] = Array.from(communesByProvince[p][d]).sort();
  }
}

fs.writeFileSync('public/address-data.json', JSON.stringify(result));
console.log('Address data generated.');
