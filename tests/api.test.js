const assert = require('assert');
const http = require('http');
const Bill = require('../model/Bill');
const app = require('../app');

const REQUIRED_KERALA_ARRAYS = [
  'districtName',
  'checkPostName',
  'vehiclePermitType',
  'vehicleClass',
  'goodsName',
  'permitType',
  'permitCategory',
  'registrationType',
  'tipperBody',
  'permit',
  'fuelType',
  'serviceType',
  'purposeOfJourney',
  'enteringDistrict',
];

const listen = (appInstance) =>
  new Promise((resolve) => {
    const server = appInstance.listen(0, () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });

const requestJson = async (method, path, body) => {
  const { server, port } = await listen(app);

  const payload = body ? Buffer.from(JSON.stringify(body)) : null;
  const options = {
    method,
    port,
    path,
    hostname: '127.0.0.1',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': payload ? payload.length : 0,
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        server.close();
        const raw = Buffer.concat(chunks).toString();
        try {
          const parsed = JSON.parse(raw || '{}');
          resolve({ status: res.statusCode, body: parsed });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      server.close();
      reject(err);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

function stubBillModel() {
  const originalFindOne = Bill.findOne;
  const originalDb = Bill.db;

  Bill.db = { readyState: 1 };

  Bill.findOne = () => ({
    sort: () => ({
      lean: async () => ({
        vehicleNo: 'TEST1234',
        chassisNo: 'CHASSIS001',
        mobileNo: '9999999999',
        ownerName: 'John Doe',
        borderBarrier: 'BORDER',
        checkpostName: 'CHECKPOST',
        permitType: 'PERMIT',
        vehiclePermitType: 'GOODS VEHICLE',
        vehicleClass: 'HCV',
        grossVehicleWeight: '1234',
        unladenWeight: '567',
      }),
    }),
  });

  return () => {
    Bill.findOne = originalFindOne;
    Bill.db = originalDb;
  };
}

async function testFieldsEndpoint() {
  const res = await requestJson('GET', '/api/fields');

  assert.strictEqual(res.status, 200, 'GET /api/fields should return 200');
  assert.ok(res.body.fields, 'Response should include fields object');
  assert.ok(res.body.fields.kerala, 'Fields should include kerala');

  const kerala = res.body.fields.kerala;
  REQUIRED_KERALA_ARRAYS.forEach((key) => {
    assert.ok(
      Array.isArray(kerala[key]),
      `kerala.${key} should be an array (even if empty)`
    );
  });
}

async function testGetDetailsEndpoint() {
  const restoreBill = stubBillModel();

  const res = await requestJson('POST', '/api/get-details', {
    vehicleNo: 'TEST1234',
  });

  assert.strictEqual(res.status, 200, 'POST /api/get-details should return 200');
  assert.strictEqual(res.body.success, true, 'Response should indicate success');
  assert.ok(res.body.detail, 'Response should include detail object');

  const detail = res.body.detail;
  ['chassisNo', 'mobileNo', 'ownerName', 'borderBarrier', 'checkpostName', 'permitType', 'vehiclePermitType', 'vehicleClass', 'grossVehicleWeight', 'unladenWeight'].forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(detail, key), `detail should contain ${key}`);
  });

  assert.strictEqual(detail.chassisNo, 'CHASSIS001');
  assert.strictEqual(detail.ownerName, 'John Doe');

  restoreBill();
}

async function run() {
  await testFieldsEndpoint();
  await testGetDetailsEndpoint();
  console.log('All API contract tests passed.');
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

