import fs from 'fs';
import path from 'path';
import { generateValidPng } from './imageGenerator';

export interface PhotoRecord {
  id: string;
  clusterId: string;
  clusterName: string;
  sessionId: string;
  sessionTitle: string;
  dayNumber: number; // 1 to 8
  date: string;
  panchayatId: string;
  panchayatName: string;
  villageId: string;
  villageName: string;
  filePath: string;
  fileUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedRole: string;
  uploadedAt: string;
  status: 'active' | 'archived';
  caption: string;
}

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const DB_FILE = path.join(process.cwd(), 'data', 'photos_db.json');

// In-memory cache synced with disk
let photoDatabase: PhotoRecord[] = [];

export function getUploadDir(): string {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

export function initPhotoStore() {
  const uploadDir = getUploadDir();

  // Load existing DB if available
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      photoDatabase = JSON.parse(data);
      console.log(`Loaded ${photoDatabase.length} photos from existing store.`);
      return;
    } catch (e) {
      console.warn('Failed to parse existing photos_db.json, creating initial store:', e);
    }
  }

  // Seed comprehensive initial photos for Day 1 through Day 8
  console.log('Seeding initial session photos for Day 1 to 8 across clusters...');
  photoDatabase = [];

  const clusters = [
    { id: 'dharmapuri', name: 'Dharmapuri' },
    { id: 'salem', name: 'Salem' },
    { id: 'krishnagiri', name: 'Krishnagiri' },
  ];

  const panchayatsDharmapuri = [
    { id: 'vedakkattamaduvu', name: 'Vedakkattamaduvu', village: 'Ammapettai' },
    { id: 'sittling', name: 'Sittling', village: 'Sittling Central' },
    { id: 'palacode', name: 'Palacode', village: 'Belarahalli' },
    { id: 'nallampalli', name: 'Nallampalli', village: 'Bandahalli' },
    { id: 'pennagaram', name: 'Pennagaram', village: 'Kootapadi' },
    { id: 'bairnaikanpatti', name: 'Bairnaikanpatti', village: 'Errahalli' },
  ];

  const topicsByDay: { [key: number]: { title: string; session: string } } = {
    1: { title: 'Math & Logic Workshop - Number Games', session: 'Day 1 Math Foundation' },
    2: { title: 'Spoken English & Dialogue Drills', session: 'Day 2 Spoken English' },
    3: { title: 'Digital Literacy & Computer Basics', session: 'Day 3 Computer Lab' },
    4: { title: 'Science Experiments & Nature Walk', session: 'Day 4 Science Explorers' },
    5: { title: 'Arts, Crafts & Origami Workshop', session: 'Day 5 Creative Arts' },
    6: { title: 'Life Skills & Time Management', session: 'Day 6 Life Skills' },
    7: { title: 'Financial Literacy & Piggy Bank Activity', session: 'Day 7 Financial Literacy' },
    8: { title: 'Valediction & Student Project Showcase', session: 'Day 8 Showcase & Awards' },
  };

  const uploaders = [
    { name: 'Rahul K.', role: 'Lead Volunteer' },
    { name: 'Priya M.', role: 'Cluster Coordinator' },
    { name: 'Bala Murugan', role: 'Mentor' },
    { name: 'Kani Muthu', role: 'Volunteer' },
    { name: 'Karthik S.', role: 'Volunteer' },
  ];

  const colorPalettes = [
    { r1: 11, g1: 61, b1: 145, r2: 255, g2: 122, b2: 0 },
    { r1: 22, g1: 101, b1: 52, r2: 134, g2: 239, b2: 172 },
    { r1: 67, g1: 56, b1: 202, r2: 219, g2: 39, b2: 119 },
    { r1: 180, g1: 83, b1: 9, r2: 251, g2: 191, b2: 36 },
  ];

  // Seed Dharmapuri Day 1 to Day 8
  clusters.forEach((cluster) => {
    const isMainCluster = cluster.id === 'dharmapuri';
    const maxDays = isMainCluster ? 8 : 4;

    for (let day = 1; day <= maxDays; day++) {
      const photosPerDay = isMainCluster ? (day === 1 ? 42 : day === 8 ? 24 : 12 + ((day * 5) % 15)) : 6;
      const topicInfo = topicsByDay[day] || { title: `Session Day ${day}`, session: `Day ${day} Workshop` };

      for (let pIdx = 1; pIdx <= photosPerDay; pIdx++) {
        const paddedIndex = String(pIdx).padStart(3, '0');
        const filename = `Photo_${paddedIndex}.png`;
        const fileDiskPath = path.join(uploadDir, `${cluster.id}_day_${day}_photo_${paddedIndex}.png`);

        // Generate actual valid PNG image file on disk if not exists
        if (!fs.existsSync(fileDiskPath)) {
          const pal = colorPalettes[(day + pIdx) % colorPalettes.length];
          const imgBuf = generateValidPng(800, 600, pal.r1, pal.g1, pal.b1, pal.r2, pal.g2, pal.b2);
          fs.writeFileSync(fileDiskPath, imgBuf);
        }

        const stats = fs.statSync(fileDiskPath);
        const pLoc = panchayatsDharmapuri[(day + pIdx) % panchayatsDharmapuri.length];
        const uploader = uploaders[(day + pIdx) % uploaders.length];
        const photoId = `photo-${cluster.id}-d${day}-${paddedIndex}`;

        photoDatabase.push({
          id: photoId,
          clusterId: cluster.id,
          clusterName: cluster.name,
          sessionId: `ses-${cluster.id}-${day}`,
          sessionTitle: topicInfo.title,
          dayNumber: day,
          date: `2026-08-${15 + day}`,
          panchayatId: pLoc.id,
          panchayatName: pLoc.name,
          villageId: `v-${pLoc.village.toLowerCase().replace(/\s+/g, '-')}`,
          villageName: pLoc.village,
          filePath: fileDiskPath,
          fileUrl: `/api/session-photos/file/${photoId}`,
          originalFilename: filename,
          mimeType: 'image/png',
          fileSize: stats.size,
          uploadedBy: uploader.name,
          uploadedRole: uploader.role,
          uploadedAt: new Date(Date.now() - (8 - day) * 86400000).toISOString(),
          status: 'active',
          caption: `${cluster.name} Day ${day} - ${topicInfo.title} at ${pLoc.village}`,
        });
      }
    }
  });

  savePhotoStore();
  console.log(`Initialized photo database with ${photoDatabase.length} photos.`);
}

export function savePhotoStore() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(photoDatabase, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save photos_db.json:', e);
  }
}

export function getAllPhotos(): PhotoRecord[] {
  return photoDatabase;
}

export function getPhotoById(id: string): PhotoRecord | undefined {
  return photoDatabase.find((p) => p.id === id);
}

export function addPhotoRecord(record: PhotoRecord): PhotoRecord {
  photoDatabase.unshift(record);
  savePhotoStore();
  return record;
}

export function deletePhotoRecord(id: string): boolean {
  const idx = photoDatabase.findIndex((p) => p.id === id);
  if (idx !== -1) {
    const item = photoDatabase[idx];
    if (item.filePath && fs.existsSync(item.filePath)) {
      try {
        fs.unlinkSync(item.filePath);
      } catch (err) {
        console.warn('Failed to delete physical file:', err);
      }
    }
    photoDatabase.splice(idx, 1);
    savePhotoStore();
    return true;
  }
  return false;
}
