import axios from "axios";

const API_URL = "http://192.168.1.9:3001/api/employees"; 
const TOTAL_REQUESTS = 200;  // total inserts
const CONCURRENCY = 20;      // number of simultaneous requests

const baseEmployee = {
  nickname: "Tester",
  position: "Staff",
  employment_type: "Full-Time",
  status: "Active",
  gender: "Male",
  contact: "639123456789",
  marital_status: "Single",
  birthday: "1999-01-01",
  address: "Sample City",
  sss_number: "12-1234567-8",
  pagibig: "1234-5678-9012",
  philhealth: "12-123456789-0",
  emergency_name: "Emergency Person",
  relationship: "Mother",
  emergency_address: "Emergency Address",
  emergency_contact: "639876543210",
  city: "Metro City",
  postal_code: "1234",
  gcash_no: "639555555555",
  start_of_contract: "2025-01-01",
  end_of_contract: "2025-12-31"
};

// generate unique employee
function generateEmployee(i) {
  return {
    ...baseEmployee,
    fullname: `Load Test User ${i}`,
    email: `loadtest${i}@test.com`
  };
}

// send requests in batches
async function sendBatch(start, end) {
  const promises = [];
  for (let i = start; i < end; i++) {
    promises.push(
      axios.post(API_URL, generateEmployee(i))
        .then(res => console.log(`✅ ${i} -> ${res.status}`))
        .catch(err => console.log(`❌ ${i} -> ${err.response?.status || err.message}`))
    );
  }
  await Promise.all(promises);
}

// run batches
(async () => {
  console.time("LoadTest");
  for (let i = 1; i <= TOTAL_REQUESTS; i += CONCURRENCY) {
    await sendBatch(i, Math.min(i + CONCURRENCY, TOTAL_REQUESTS + 1));
  }
  console.timeEnd("LoadTest");
})();
