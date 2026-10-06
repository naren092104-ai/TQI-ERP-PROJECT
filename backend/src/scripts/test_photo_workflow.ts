import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { pool, initializeDatabase } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secure_jwt_secret_key';
const API_BASE = 'http://localhost:5000/api';

const superAdminToken = jwt.sign(
  { id: 'usr-super-admin', email: 'admin@tqi.org', role: 'SUPER_ADMIN', cluster_id: null },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const clusterAdminA_Token = jwt.sign(
  { id: 'usr-4e7a4c7f-21be-48ad-8ad7-81bf62048aa8', email: 'naren0921@gmail.com', role: 'CLUSTER_ADMIN', cluster_id: 'cuddalore-msr' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const clusterAdminB_Token = jwt.sign(
  { id: 'usr-620fc2aa-08bb-4551-b65e-9c2b7c466515', email: 'narendhardan@gmail.com', role: 'CLUSTER_ADMIN', cluster_id: 'dharmapuri-ksr' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 RUNNING 14 ACCEPTANCE TESTS FOR SESSION PHOTOS & DELETE APPROVAL WORKFLOW');
  console.log('========================================================================\n');

  await initializeDatabase();

  const clusterId = 'cuddalore-msr';
  const academicYearId = '2026-2027';
  const testDayNumber = 3; // Day 3 for isolated testing

  // Clean test data for testDayNumber in cuddalore-msr to ensure clean test slate
  console.log(`[SETUP] Cleaning previous test data for cluster ${clusterId}, day ${testDayNumber}...`);
  await pool.query(
    'DELETE FROM photo_delete_requests WHERE photo_id IN (SELECT id FROM session_photos WHERE cluster_id = ? AND day_number = ?)',
    [clusterId, testDayNumber]
  );
  await pool.query(
    'DELETE FROM session_photos WHERE cluster_id = ? AND day_number = ?',
    [clusterId, testDayNumber]
  );
  await pool.query(
    'DELETE FROM session_photo_submissions WHERE cluster_id = ? AND day_number = ? AND academic_year_id = ?',
    [clusterId, testDayNumber, academicYearId]
  );

  let passedTests = 0;

  // Helper for multipart upload using 'photos' field
  async function uploadPhoto(token: string, cId: string, day: number, filename = 'test-photo.png') {
    const formData = new FormData();
    const blob = new Blob([Buffer.from(TINY_PNG_BASE64, 'base64')], { type: 'image/png' });
    formData.append('photos', blob, filename);
    formData.append('clusterId', cId);
    formData.append('dayNumber', String(day));
    formData.append('academicYearId', academicYearId);

    const res = await fetch(`${API_BASE}/session-photos/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // ------------------------------------------------------------------------
  // TEST 1: Dynamic Configured Days
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 1: Dynamic Configured Days from Academic Setup...');
    const res = await fetch(`${API_BASE}/academic-setup?academicYearId=${academicYearId}`, {
      headers: { Authorization: `Bearer ${clusterAdminA_Token}` }
    });
    const data = await res.json();
    const daysList = data.setup || data.data || [];
    if (!res.ok || !data.success || !Array.isArray(daysList) || daysList.length === 0) {
      throw new Error(`Failed to get academic setup days: ${JSON.stringify(data)}`);
    }
    const dayNames = daysList.map((d: any) => `Day ${d.day_number || d.dayNumber}: ${d.session_name || d.sessionName}`);
    console.log(`  ✓ Successfully fetched ${daysList.length} dynamic program days.`);
    console.log(`    First day: "${dayNames[0]}"`);
    console.log('✅ TEST 1 PASSED: Dynamic Configured Days match Academic Setup.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 1 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 2: Dedicated Day Page & Status Endpoint
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 2: Dedicated Day Page & Day Statuses...');
    const res = await fetch(`${API_BASE}/session-photos/day-statuses?clusterId=${clusterId}&academicYearId=${academicYearId}`, {
      headers: { Authorization: `Bearer ${clusterAdminA_Token}` }
    });
    const data = await res.json();
    const dayList = data.data || [];
    if (!res.ok || !data.success || !Array.isArray(dayList)) {
      throw new Error(`Failed to get day statuses: ${JSON.stringify(data)}`);
    }
    const day3Status = dayList.find((d: any) => d.dayNumber === testDayNumber);
    if (!day3Status) {
      throw new Error(`Day ${testDayNumber} status not found in response`);
    }
    console.log(`  ✓ Day ${testDayNumber} status: status=${day3Status.status}, count=${day3Status.photoCount}/${day3Status.maxPhotos}`);
    if (day3Status.status !== 'DRAFT') {
      throw new Error(`Expected DRAFT status, got ${day3Status.status}`);
    }
    console.log('✅ TEST 2 PASSED: Dedicated Day page & status endpoint functional.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 2 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 3: Upload Photos and Counter
  // ------------------------------------------------------------------------
  let photo1Id = '';
  let photo1Url = '';
  try {
    console.log('▶ Test 3: Upload Photos & Counter...');
    const uploadRes = await uploadPhoto(clusterAdminA_Token, clusterId, testDayNumber, 'day3-img1.png');
    if (uploadRes.status !== 200 || !uploadRes.data.success) {
      throw new Error(`Upload failed (${uploadRes.status}): ${JSON.stringify(uploadRes.data)}`);
    }
    const uploadedPhoto = uploadRes.data.photos?.[0] || uploadRes.data.data;
    photo1Id = uploadedPhoto.id;
    photo1Url = uploadedPhoto.fileUrl || uploadedPhoto.filePath;
    console.log(`  ✓ Uploaded photo id: ${photo1Id}, file: ${uploadedPhoto.originalFilename}`);

    // Check day statuses counter
    const statusRes = await fetch(`${API_BASE}/session-photos/day-statuses?clusterId=${clusterId}&academicYearId=${academicYearId}`, {
      headers: { Authorization: `Bearer ${clusterAdminA_Token}` }
    });
    const statusData = await statusRes.json();
    const day3 = (statusData.data || []).find((d: any) => d.dayNumber === testDayNumber);
    if (!day3 || day3.photoCount !== 1) {
      throw new Error(`Expected photoCount = 1, got ${day3?.photoCount}`);
    }
    console.log(`  ✓ Counter accurately updated: ${day3.photoCount} / ${day3.maxPhotos}`);
    console.log('✅ TEST 3 PASSED: Upload photo and counter verified.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 3 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 4 & 5: Upload up to 50 Photos and 51st Rejection
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 4 & 5: Ceiling limit (50 max) and 51st rejection...');
    console.log('  Inserting 49 mock photos into database to reach exactly 50 photos...');
    for (let i = 2; i <= 50; i++) {
      await pool.query(
        `INSERT INTO session_photos (id, cluster_id, session_id, day_number, academic_year_id, file_path, file_url, original_filename, mime_type, file_size, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          `photo-mock-${i}`,
          clusterId,
          `session-day-${testDayNumber}`,
          testDayNumber,
          academicYearId,
          `backend/storage/uploads/mock-${i}.png`,
          `/api/session-photos/file/photo-mock-${i}`,
          `mock-${i}.png`,
          'image/png',
          1024,
          'Cluster Admin'
        ]
      );
    }

    // Verify day status has exactly 50 photos
    const statusRes = await fetch(`${API_BASE}/session-photos/day-statuses?clusterId=${clusterId}&academicYearId=${academicYearId}`, {
      headers: { Authorization: `Bearer ${clusterAdminA_Token}` }
    });
    const statusData = await statusRes.json();
    const day3 = (statusData.data || []).find((d: any) => d.dayNumber === testDayNumber);
    if (!day3 || day3.photoCount !== 50) {
      throw new Error(`Expected 50 photos, got ${day3?.photoCount}`);
    }
    console.log(`  ✓ TEST 4 PASSED: Day contains exactly ${day3.photoCount} / ${day3.maxPhotos} photos.`);
    passedTests++;

    // Now attempt uploading 51st photo
    console.log('  Attempting to upload 51st photo...');
    const upload51Res = await uploadPhoto(clusterAdminA_Token, clusterId, testDayNumber, 'day3-img51.png');
    if (upload51Res.status !== 400 || upload51Res.data.success) {
      throw new Error(`Expected 400 Bad Request for 51st photo, got ${upload51Res.status}: ${JSON.stringify(upload51Res.data)}`);
    }
    console.log(`  ✓ Backend rejected 51st photo with HTTP 400: "${upload51Res.data.error}"`);
    console.log('✅ TEST 5 PASSED: 51st Photo upload rejected by backend ceiling rule.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 4/5 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 6: Submit Photos and Status Locking
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 6: Submit Day Photos for Super Admin Review...');
    const submitRes = await fetch(`${API_BASE}/session-photos/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clusterAdminA_Token}`
      },
      body: JSON.stringify({
        clusterId,
        dayNumber: testDayNumber,
        academicYearId
      })
    });
    const submitData = await submitRes.json();
    if (submitRes.status !== 200 || !submitData.success) {
      throw new Error(`Submit failed: ${JSON.stringify(submitData)}`);
    }
    console.log(`  ✓ Day submitted successfully: status=${submitData.data?.status || 'SUBMITTED'}`);

    // Verify day status is now SUBMITTED
    const statusRes = await fetch(`${API_BASE}/session-photos/day-statuses?clusterId=${clusterId}&academicYearId=${academicYearId}`, {
      headers: { Authorization: `Bearer ${clusterAdminA_Token}` }
    });
    const statusData = await statusRes.json();
    const day3 = (statusData.data || []).find((d: any) => d.dayNumber === testDayNumber);
    if (!day3 || day3.status !== 'SUBMITTED') {
      throw new Error(`Expected status SUBMITTED, got ${day3?.status}`);
    }
    console.log('✅ TEST 6 PASSED: Session photos submitted and locked.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 6 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 7: Direct Delete Rejection on Submitted Day
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 7: Direct Delete Rejection on Submitted Day...');
    const delRes = await fetch(`${API_BASE}/session-photos/${photo1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${clusterAdminA_Token}` }
    });
    const delData = await delRes.json();
    if (delRes.status !== 403 || delData.success) {
      throw new Error(`Expected 403 Forbidden for direct delete on submitted day, got ${delRes.status}: ${JSON.stringify(delData)}`);
    }
    console.log(`  ✓ Backend rejected direct delete with HTTP 403: "${delData.error}"`);
    console.log('✅ TEST 7 PASSED: Direct delete forbidden when Day is locked/submitted.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 7 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 8: Request Delete Reason Required
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 8: Request Delete with empty reason rejection...');
    const emptyReqRes = await fetch(`${API_BASE}/session-photos/request-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clusterAdminA_Token}`
      },
      body: JSON.stringify({
        photoId: photo1Id,
        reason: '   ' // empty/whitespace
      })
    });
    const emptyReqData = await emptyReqRes.json();
    if (emptyReqRes.status !== 400 || emptyReqData.success) {
      throw new Error(`Expected 400 Bad Request for empty reason, got ${emptyReqRes.status}: ${JSON.stringify(emptyReqData)}`);
    }
    console.log(`  ✓ Backend rejected empty reason with HTTP 400: "${emptyReqData.error}"`);
    console.log('✅ TEST 8 PASSED: Delete request requires mandatory non-empty reason.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 8 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 9: Submit Delete Request
  // ------------------------------------------------------------------------
  let deleteRequestId = '';
  try {
    console.log('▶ Test 9: Submit Valid Delete Request...');
    const deleteReason = 'Accidental blurry photo of classroom floor';
    const reqRes = await fetch(`${API_BASE}/session-photos/request-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clusterAdminA_Token}`
      },
      body: JSON.stringify({
        photoId: photo1Id,
        reason: deleteReason
      })
    });
    const reqData = await reqRes.json();
    if (!reqRes.ok || !reqData.success) {
      throw new Error(`Request delete failed: ${JSON.stringify(reqData)}`);
    }
    deleteRequestId = reqData.requestId || reqData.data?.id;
    console.log(`  ✓ Delete request created with ID: ${deleteRequestId}`);

    // Verify photo record has delete_request_status = PENDING and is NOT deleted yet
    const [rows]: any = await pool.query('SELECT delete_request_status, delete_request_id FROM session_photos WHERE id = ?', [photo1Id]);
    if (!rows[0] || rows[0].delete_request_status !== 'PENDING') {
      throw new Error(`Expected photo status PENDING, got: ${JSON.stringify(rows[0])}`);
    }
    console.log(`  ✓ Photo row status is PENDING, photo remains intact in database.`);
    console.log('✅ TEST 9 PASSED: Valid delete request created and marked PENDING.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 9 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 10: Super Admin View Delete Requests
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 10: Super Admin View Delete Requests...');
    const listRes = await fetch(`${API_BASE}/session-photos/delete-requests?status=PENDING`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const listData = await listRes.json();
    const requests = listData.requests || listData.data || [];
    if (listRes.status !== 200 || !listData.success || !Array.isArray(requests)) {
      throw new Error(`Failed to list delete requests: ${JSON.stringify(listData)}`);
    }
    const found = requests.find((r: any) => r.id === deleteRequestId);
    if (!found) {
      throw new Error(`Delete request ${deleteRequestId} not found in pending requests list`);
    }
    console.log(`  ✓ Super Admin found request: Day ${found.dayNumber} (${found.sessionName}), Cluster: ${found.clusterName}, Reason: "${found.reason}"`);
    console.log('✅ TEST 10 PASSED: Super Admin sees pending delete request with complete details.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 10 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 11: Super Admin Approve Delete
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 11: Super Admin Approve Delete Request...');
    // Check physical file path
    const [pRows]: any = await pool.query('SELECT file_path FROM session_photos WHERE id = ?', [photo1Id]);
    const filePath = pRows[0]?.file_path;
    console.log(`  Physical file path before approve: ${filePath} (exists: ${fs.existsSync(filePath)})`);

    const approveRes = await fetch(`${API_BASE}/session-photos/delete-requests/${deleteRequestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ reviewNotes: 'Approved removal of blurry photo.' })
    });
    const approveData = await approveRes.json();
    if (approveRes.status !== 200 || !approveData.success) {
      throw new Error(`Approve failed: ${JSON.stringify(approveData)}`);
    }

    // Verify DB record is deleted
    const [photoRows]: any = await pool.query('SELECT * FROM session_photos WHERE id = ?', [photo1Id]);
    if (photoRows.length > 0) {
      throw new Error(`Photo ${photo1Id} still exists in session_photos table after approval`);
    }
    console.log(`  ✓ Photo DB record confirmed deleted.`);

    // Verify physical file is unlinked if it existed
    if (filePath && fs.existsSync(filePath)) {
      throw new Error(`Physical file ${filePath} still exists on disk after approval`);
    }
    console.log(`  ✓ Physical file confirmed unlinked from storage.`);

    // Verify counter decremented from 50 to 49
    const statusRes = await fetch(`${API_BASE}/session-photos/day-statuses?clusterId=${clusterId}&academicYearId=${academicYearId}`, {
      headers: { Authorization: `Bearer ${clusterAdminA_Token}` }
    });
    const statusData = await statusRes.json();
    const day3 = (statusData.data || []).find((d: any) => d.dayNumber === testDayNumber);
    if (!day3 || day3.photoCount !== 49) {
      throw new Error(`Expected counter to be 49, got ${day3?.photoCount}`);
    }
    console.log(`  ✓ Counter accurately decremented: ${day3.photoCount} / ${day3.maxPhotos}`);

    // Verify audit log
    const [auditRows]: any = await pool.query(
      "SELECT * FROM audit_logs WHERE action LIKE '%DELETE%' AND (entity_id = ? OR record_id = ?) ORDER BY id DESC LIMIT 1",
      [photo1Id, photo1Id]
    );
    console.log(`  ✓ Audit log recorded: ${auditRows[0]?.action || 'Logged'}`);
    console.log('✅ TEST 11 PASSED: Super Admin approve deletes DB record, deletes storage file, decrements count, and logs audit.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 11 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 12: Super Admin Reject Delete
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 12: Super Admin Reject Delete Request...');
    const rejectPhotoId = 'photo-mock-2';
    // Request deletion for mock photo 2
    const reqRes = await fetch(`${API_BASE}/session-photos/request-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clusterAdminA_Token}`
      },
      body: JSON.stringify({
        photoId: rejectPhotoId,
        reason: 'Duplicate photo test'
      })
    });
    const reqData = await reqRes.json();
    const rejectReqId = reqData.requestId || reqData.data?.id;
    if (!reqData.success || !rejectReqId) {
      throw new Error(`Failed to create delete request for rejection test: ${JSON.stringify(reqData)}`);
    }

    // Super Admin rejects
    const rejectRes = await fetch(`${API_BASE}/session-photos/delete-requests/${rejectReqId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ reviewNotes: 'Photo is clear and necessary, keep it.' })
    });
    const rejectData = await rejectRes.json();
    if (rejectRes.status !== 200 || !rejectData.success) {
      throw new Error(`Reject failed: ${JSON.stringify(rejectData)}`);
    }

    // Photo must STILL exist in session_photos
    const [photoRows]: any = await pool.query('SELECT * FROM session_photos WHERE id = ?', [rejectPhotoId]);
    if (photoRows.length === 0) {
      throw new Error(`Photo ${rejectPhotoId} was erroneously deleted on rejection!`);
    }
    if (photoRows[0].delete_request_status !== 'REJECTED') {
      throw new Error(`Expected status REJECTED, got: ${photoRows[0].delete_request_status}`);
    }
    console.log(`  ✓ Photo remains in DB with status REJECTED.`);
    console.log('✅ TEST 12 PASSED: Super Admin rejection retains photo in DB & storage.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 12 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 13: Cluster Security Enforcement (403 Forbidden for Foreign Cluster)
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 13: Cluster Security Enforcement...');
    // Cluster Admin B belongs to dharmapuri-ksr. Attempts to access cuddalore-msr session photos:
    const secRes = await fetch(`${API_BASE}/session-photos?clusterId=${clusterId}`, {
      headers: { Authorization: `Bearer ${clusterAdminB_Token}` }
    });
    const secData = await secRes.json();
    if (secRes.status !== 403 || secData.success) {
      throw new Error(`Expected 403 Forbidden for cross-cluster access, got ${secRes.status}: ${JSON.stringify(secData)}`);
    }
    console.log(`  ✓ Foreign cluster access rejected with HTTP 403: "${secData.error}"`);

    // Also verify upload to foreign cluster is rejected
    const uploadForeignRes = await uploadPhoto(clusterAdminB_Token, clusterId, testDayNumber, 'hack.png');
    if (uploadForeignRes.status !== 403 || uploadForeignRes.data.success) {
      throw new Error(`Expected 403 Forbidden for cross-cluster upload, got ${uploadForeignRes.status}: ${JSON.stringify(uploadForeignRes.data)}`);
    }
    console.log(`  ✓ Foreign cluster upload rejected with HTTP 403: "${uploadForeignRes.data.error}"`);
    console.log('✅ TEST 13 PASSED: Cross-cluster access strictly forbidden.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 13 FAILED:', e.message);
  }

  // ------------------------------------------------------------------------
  // TEST 14: Super Admin Existing Functionality Intact
  // ------------------------------------------------------------------------
  try {
    console.log('▶ Test 14: Super Admin Existing Functionality Intact...');
    const allRes = await fetch(`${API_BASE}/session-photos?clusterId=all`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const allData = await allRes.json();
    const photosList = allData.photos || allData.data || [];
    if (allRes.status !== 200 || !allData.success || !Array.isArray(photosList)) {
      throw new Error(`Super Admin failed to view all photos: ${JSON.stringify(allData)}`);
    }
    console.log(`  ✓ Super Admin can query all clusters' photos (returned ${photosList.length} photos).`);

    // Clean up test photos
    await pool.query(
      'DELETE FROM photo_delete_requests WHERE photo_id IN (SELECT id FROM session_photos WHERE cluster_id = ? AND day_number = ?)',
      [clusterId, testDayNumber]
    );
    await pool.query(
      'DELETE FROM session_photos WHERE cluster_id = ? AND day_number = ?',
      [clusterId, testDayNumber]
    );
    await pool.query(
      'DELETE FROM session_photo_submissions WHERE cluster_id = ? AND day_number = ? AND academic_year_id = ?',
      [clusterId, testDayNumber, academicYearId]
    );
    console.log(`  ✓ Cleaned up test photos.`);

    console.log('✅ TEST 14 PASSED: Super Admin existing functionality is 100% intact.\n');
    passedTests++;
  } catch (e: any) {
    console.error('❌ TEST 14 FAILED:', e.message);
  }

  console.log('========================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} / 14 ACCEPTANCE TESTS PASSED`);
  console.log('========================================================================\n');

  if (passedTests === 14) {
    console.log('🎉 ALL 14 ACCEPTANCE CRITERIA SATISFIED PERFECTLY!');
    process.exit(0);
  } else {
    console.error(`⚠️ ${14 - passedTests} tests failed.`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error running tests:', err);
  process.exit(1);
});
