import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2, Calendar, Clock, Users, Search, Sparkles, Map, BookOpen,
  Bell, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, History,
  Plus, LogOut, UserCheck, Settings, RefreshCw, ChevronRight, Filter,
  MessageSquareWarning, ArrowRight, Info, Layers, DoorOpen, Edit3, Check, X
} from 'lucide-react';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
const getBaseApiUrl = () => {
  try {
    if (typeof window !== 'undefined' && window.VITE_API_URL) {
      return window.VITE_API_URL;
    }
    if (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) {
      return process.env.VITE_API_URL;
    }
  } catch (e) {
    // Fallback to default localhost URL
  }
  return 'http://localhost:8000';
};

const DEFAULT_API_URL = getBaseApiUrl();

const ROOM_TYPES = [
  { value: 'classroom', label: 'Classroom' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'seminar_hall', label: 'Seminar Hall' },
  { value: 'library', label: 'Library' },
  { value: 'office', label: 'Office' }
];

const PURPOSES = [
  { value: 'extra_class', label: 'Extra Class' },
  { value: 'minor_exam', label: 'Minor Exam' },
  { value: 'practical', label: 'Practical / Lab' },
  { value: 'event', label: 'Academic Event / Seminar' }
];

const ANNOUNCEMENT_KINDS = {
  cancellation: { label: 'Cancellation', bg: 'bg-red-100 text-red-800 border-red-300' },
  reschedule: { label: 'Rescheduled', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
  exam_notice: { label: 'Exam Notice', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
  general: { label: 'General Notice', bg: 'bg-blue-100 text-blue-800 border-blue-300' }
};

// Helper for current campus date in YYYY-MM-DD
const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysStr = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeShort = (isoStr) => {
  if (!isoStr) return '';
  const parts = isoStr.split('T');
  return parts[1] ? parts[1].slice(0, 5) : isoStr;
};

const formatDateReadable = (isoOrDateStr) => {
  if (!isoOrDateStr) return '';
  const dStr = isoOrDateStr.split('T')[0];
  const d = new Date(dStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// ============================================================================
// BUILT-IN MOCK API ADAPTER (Faithful implementation of API_CONTRACT.md)
// ============================================================================
const createInitialMockState = () => {
  const today = getTodayStr();
  const tomorrow = addDaysStr(today, 1);

  const buildings = [
    { id: 1, name: 'Institute of Engineering & Technology (IET)', code: 'IET', notes: 'Main Engineering Block (3 Floors)' },
    { id: 2, name: 'Deeksha Bhawan', code: 'DEEKSHA', notes: 'Lecture Hall Complex (Ground & First Floor)' }
  ];

  const batches = [
    { id: 1, branch: 'CSE', year: 1, section: 'A', size: 65, label: 'CSE Year 1 Sec A' },
    { id: 2, branch: 'CSE', year: 2, section: 'A', size: 70, label: 'CSE Year 2 Sec A' },
    { id: 3, branch: 'CSE', year: 2, section: 'B', size: 68, label: 'CSE Year 2 Sec B' },
    { id: 4, branch: 'ECE', year: 2, section: 'A', size: 60, label: 'ECE Year 2 Sec A' },
    { id: 5, branch: 'IT', year: 3, section: 'A', size: 55, label: 'IT Year 3 Sec A' },
    { id: 6, branch: 'ME', year: 4, section: 'A', size: 50, label: 'ME Year 4 Sec A' }
  ];

  // Rooms strictly matching the blueprint in FRONTEND_PROMPT.md
  const rooms = [
    // IET Ground Floor (floor 0)
    { id: 101, name: 'Library', building_id: 1, building: 'IET', floor: 0, type: 'library', capacity: 120, capacity_assumed: true, allowed_uses: ['event'], is_bookable: false, notes: 'Central IET Departmental Library' },
    { id: 102, name: "Teachers' Office", building_id: 1, building: 'IET', floor: 0, type: 'office', capacity: 25, capacity_assumed: true, allowed_uses: [], is_bookable: false, notes: 'Faculty Cabin Area' },
    { id: 103, name: 'Placement Cell', building_id: 1, building: 'IET', floor: 0, type: 'office', capacity: 30, capacity_assumed: true, allowed_uses: ['event'], is_bookable: false, notes: 'Training & Placement Office' },
    { id: 104, name: 'Director Office', building_id: 1, building: 'IET', floor: 0, type: 'office', capacity: 15, capacity_assumed: true, allowed_uses: [], is_bookable: false, notes: 'Director IET Administration' },

    // IET First Floor (floor 1): Top row IET22, 16, 14, 15 | Bottom row IET20, 19, 18, 17
    { id: 1, name: 'IET22', building_id: 1, building: 'IET', floor: 1, type: 'classroom', capacity: 75, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam', 'event'], is_bookable: true, notes: 'Projector equipped' },
    { id: 2, name: 'IET16', building_id: 1, building: 'IET', floor: 1, type: 'classroom', capacity: 70, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam'], is_bookable: true, notes: null },
    { id: 3, name: 'IET14', building_id: 1, building: 'IET', floor: 1, type: 'lab', capacity: 60, capacity_assumed: true, allowed_uses: ['practical', 'extra_class'], is_bookable: true, notes: 'Computer Programming Lab' },
    { id: 4, name: 'IET15', building_id: 1, building: 'IET', floor: 1, type: 'classroom', capacity: 70, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam'], is_bookable: true, notes: null },
    { id: 5, name: 'IET20', building_id: 1, building: 'IET', floor: 1, type: 'classroom', capacity: 80, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam', 'event'], is_bookable: true, notes: 'Smart Board available' },
    { id: 6, name: 'IET19', building_id: 1, building: 'IET', floor: 1, type: 'classroom', capacity: 75, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam', 'event'], is_bookable: true, notes: 'Main CSE Lecture Room' },
    { id: 7, name: 'IET18', building_id: 1, building: 'IET', floor: 1, type: 'classroom', capacity: 65, capacity_assumed: true, allowed_uses: ['extra_class', 'minor_exam'], is_bookable: true, notes: null },
    { id: 8, name: 'IET17', building_id: 1, building: 'IET', floor: 1, type: 'lab', capacity: 50, capacity_assumed: true, allowed_uses: ['practical'], is_bookable: true, notes: 'Electronics & Digital Logic Lab' },

    // IET Second Floor (floor 2): Top row IET32 (seminar hall), 24, 25 | Bottom row IET30, 29, 28, 23
    { id: 9, name: 'IET32', building_id: 1, building: 'IET', floor: 2, type: 'seminar_hall', capacity: 160, capacity_assumed: false, allowed_uses: ['event', 'minor_exam', 'extra_class'], is_bookable: true, notes: 'IET Seminar Hall with PA System' },
    { id: 10, name: 'IET24', building_id: 1, building: 'IET', floor: 2, type: 'classroom', capacity: 75, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam'], is_bookable: true, notes: null },
    { id: 11, name: 'IET25', building_id: 1, building: 'IET', floor: 2, type: 'classroom', capacity: 75, capacity_assumed: true, allowed_uses: ['extra_class', 'minor_exam'], is_bookable: true, notes: null },
    { id: 12, name: 'IET30', building_id: 1, building: 'IET', floor: 2, type: 'classroom', capacity: 70, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam'], is_bookable: true, notes: null },
    { id: 13, name: 'IET29', building_id: 1, building: 'IET', floor: 2, type: 'classroom', capacity: 70, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam'], is_bookable: true, notes: null },
    { id: 14, name: 'IET28', building_id: 1, building: 'IET', floor: 2, type: 'lab', capacity: 60, capacity_assumed: true, allowed_uses: ['practical', 'extra_class'], is_bookable: true, notes: 'Networking & OS Lab' },
    { id: 15, name: 'IET23', building_id: 1, building: 'IET', floor: 2, type: 'classroom', capacity: 65, capacity_assumed: false, allowed_uses: ['extra_class', 'minor_exam'], is_bookable: true, notes: null },

    // Deeksha Bhawan Ground Floor (floor 0): LH01 to LH07
    ...[1, 2, 3, 4, 5, 6, 7].map(n => ({
      id: 20 + n,
      name: `LH0${n}`,
      building_id: 2,
      building: 'Deeksha Bhawan',
      floor: 0,
      type: 'classroom',
      capacity: n === 1 || n === 7 ? 120 : 90,
      capacity_assumed: n % 2 === 0,
      allowed_uses: ['extra_class', 'minor_exam', 'event'],
      is_bookable: true,
      notes: `Deeksha Ground Lecture Hall 0${n}`
    })),

    // Deeksha Bhawan First Floor (floor 1): LH08 to LH14
    ...[8, 9, 10, 11, 12, 13, 14].map(n => ({
      id: 20 + n,
      name: n < 10 ? `LH0${n}` : `LH${n}`,
      building_id: 2,
      building: 'Deeksha Bhawan',
      floor: 1,
      type: 'classroom',
      capacity: n === 14 ? 150 : 95,
      capacity_assumed: n === 11 || n === 13,
      allowed_uses: ['extra_class', 'minor_exam', 'event'],
      is_bookable: true,
      notes: `Deeksha First Floor Lecture Hall ${n}`
    }))
  ];

  const users = [
    { id: 1, email: 'admin@demo.test', name: 'Demo Admin (test)', role: 'admin', batch_id: null, batch: null, is_test: true },
    { id: 2, email: 'faculty@demo.test', name: 'Dr. R. K. Pandey (test)', role: 'faculty', batch_id: null, batch: null, is_test: true },
    { id: 3, email: 'student@demo.test', name: 'Aarav Verma (test)', role: 'student', batch_id: 2, batch: batches[1], is_test: true },
    { id: 4, email: 'sharma.cs@ddugu.ac.in', name: 'Prof. S. Sharma', role: 'faculty', batch_id: null, batch: null, is_test: false }
  ];

  const bookings = [
    {
      id: 101,
      room_id: 6, // IET19
      room: { id: 6, name: 'IET19', building: 'IET', floor: 1 },
      title: 'Data Structures & Algorithms',
      purpose: 'extra_class',
      start_at: `${today}T10:00:00`,
      end_at: `${today}T11:00:00`,
      status: 'confirmed',
      expected_attendees: 70,
      booked_by: { id: 2, name: 'Dr. R. K. Pandey (test)' },
      batches: [{ id: 2, label: 'CSE Year 2 Sec A' }],
      notes: 'Trees & Graph Traversal problem solving session',
      is_test: true
    },
    {
      id: 102,
      room_id: 1, // IET22
      room: { id: 1, name: 'IET22', building: 'IET', floor: 1 },
      title: 'Operating Systems Minor Test',
      purpose: 'minor_exam',
      start_at: `${today}T11:00:00`,
      end_at: `${today}T12:30:00`,
      status: 'confirmed',
      expected_attendees: 70,
      booked_by: { id: 2, name: 'Dr. R. K. Pandey (test)' },
      batches: [{ id: 2, label: 'CSE Year 2 Sec A' }],
      notes: 'Bring university ID card',
      is_test: true
    },
    {
      id: 103,
      room_id: 3, // IET14 Lab
      room: { id: 3, name: 'IET14', building: 'IET', floor: 1 },
      title: 'DBMS SQL Lab Session',
      purpose: 'practical',
      start_at: `${today}T14:00:00`,
      end_at: `${today}T16:00:00`,
      status: 'cancelled',
      expected_attendees: 65,
      booked_by: { id: 2, name: 'Dr. R. K. Pandey (test)' },
      batches: [{ id: 2, label: 'CSE Year 2 Sec A' }],
      notes: 'Cancelled due to server maintenance in lab',
      is_test: true
    },
    {
      id: 104,
      room_id: 21, // LH01
      room: { id: 21, name: 'LH01', building: 'Deeksha Bhawan', floor: 0 },
      title: 'Discrete Mathematics Combined Lecture',
      purpose: 'extra_class',
      start_at: `${today}T10:00:00`,
      end_at: `${today}T11:30:00`,
      status: 'confirmed',
      expected_attendees: 110,
      booked_by: { id: 4, name: 'Prof. S. Sharma' },
      batches: [{ id: 3, label: 'CSE Year 2 Sec B' }, { id: 4, label: 'ECE Year 2 Sec A' }],
      notes: 'Combinatorics & Generating Functions',
      is_test: false
    },
    {
      id: 105,
      room_id: 9, // IET32 Seminar Hall
      room: { id: 9, name: 'IET32', building: 'IET', floor: 2 },
      title: 'IEEE Student Branch Tech Talk',
      purpose: 'event',
      start_at: `${tomorrow}T14:00:00`,
      end_at: `${tomorrow}T16:00:00`,
      status: 'confirmed',
      expected_attendees: 140,
      booked_by: { id: 2, name: 'Dr. R. K. Pandey (test)' },
      batches: [{ id: 2, label: 'CSE Year 2 Sec A' }, { id: 5, label: 'IT Year 3 Sec A' }],
      notes: 'Guest speaker on Cloud Native Architecture',
      is_test: true
    }
  ];

  const announcements = [
    {
      id: 1,
      title: 'Cancelled: DBMS SQL Lab Session (IET14)',
      body: 'The DBMS SQL Lab scheduled for today 14:00–16:00 in IET14 for CSE Year 2 Sec A has been cancelled. Reason: Server maintenance in computer lab.',
      kind: 'cancellation',
      booking_id: 103,
      created_at: `${today}T08:30:00`,
      author: 'Dr. R. K. Pandey (test)',
      batches: ['CSE Year 2 Sec A'],
      is_test: true
    },
    {
      id: 2,
      title: 'Minor Exam Notice: Operating Systems (CSE Year 2 Sec A)',
      body: 'Operating Systems Minor Exam will be held in Room IET22 from 11:00 AM to 12:30 PM. Seating is strictly according to roll numbers.',
      kind: 'exam_notice',
      booking_id: 102,
      created_at: `${today}T08:00:00`,
      author: 'Dr. R. K. Pandey (test)',
      batches: ['CSE Year 2 Sec A'],
      is_test: true
    },
    {
      id: 3,
      title: 'Deeksha Bhawan Wi-Fi Upgrade Completed',
      body: 'High-speed campus Wi-Fi access points are now operational across LH01–LH14 in Deeksha Bhawan.',
      kind: 'general',
      booking_id: null,
      created_at: `${today}T07:15:00`,
      author: 'Demo Admin (test)',
      batches: [],
      is_test: true
    }
  ];

  const reports = [
    {
      id: 1,
      kind: 'outdated',
      text: 'Projector HDMI cable in IET19 has a loose connection during morning lectures.',
      booking_id: 101,
      booking_title: 'Data Structures & Algorithms (IET19)',
      status: 'open',
      created_by: { id: 3, name: 'Aarav Verma (test)', role: 'student' },
      created_at: `${today}T09:15:00`,
      is_test: true
    },
    {
      id: 2,
      kind: 'conflict',
      text: 'Notice board outside LH01 still shows old timetable for Sec B.',
      booking_id: 104,
      booking_title: 'Discrete Mathematics Combined Lecture (LH01)',
      status: 'resolved',
      created_by: { id: 3, name: 'Aarav Verma (test)', role: 'student' },
      created_at: `${today}T08:40:00`,
      is_test: true
    }
  ];

  const audits = [
    {
      id: 1,
      entity: 'booking',
      entity_id: 101,
      action: 'created',
      actor: 'Dr. R. K. Pandey (test)',
      timestamp: `${today}T07:30:00`,
      old_value: null,
      new_value: { room: 'IET19', start_at: `${today}T10:00:00`, end_at: `${today}T11:00:00`, status: 'confirmed' },
      is_test: true
    },
    {
      id: 2,
      entity: 'booking',
      entity_id: 103,
      action: 'created',
      actor: 'Dr. R. K. Pandey (test)',
      timestamp: `${today}T07:45:00`,
      old_value: null,
      new_value: { room: 'IET14', start_at: `${today}T14:00:00`, end_at: `${today}T16:00:00`, status: 'confirmed' },
      is_test: true
    },
    {
      id: 3,
      entity: 'booking',
      entity_id: 103,
      action: 'cancelled',
      actor: 'Dr. R. K. Pandey (test)',
      timestamp: `${today}T08:30:00`,
      old_value: { status: 'confirmed' },
      new_value: { status: 'cancelled', reason: 'Server maintenance in computer lab' },
      is_test: true
    }
  ];

  return { buildings, batches, rooms, users, bookings, announcements, reports, audits };
};

// ============================================================================
// REUSABLE UI BADGES & HELPERS
// ============================================================================
const TestDataBadge = ({ show }) => {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-400 rounded shadow-sm">
      <AlertTriangle className="w-3 h-3 text-amber-700" />
      TEST DATA
    </span>
  );
};

const CapacityAssumedBadge = ({ assumed }) => {
  if (!assumed) return null;
  return (
    <span className="text-xs italic text-slate-500 ml-1 font-normal">
      (capacity assumed)
    </span>
  );
};

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  // Mode & Server state
  const [apiMode, setApiMode] = useState('checking'); // 'checking' | 'live' | 'mock'
  const [wakingUpServer, setWakingUpServer] = useState(true);
  const [simulateAi503, setSimulateAi503] = useState(false);

  // Mock database state (persisted in memory for immediate interactive demo)
  const [mockDb, setMockDb] = useState(() => createInitialMockState());

  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem('ddu_campus_token') || '');
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('ddu_campus_user');
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  });

  // Navigation state
  const [activeTab, setActiveTab] = useState('find_room');
  const [prefillBooking, setPrefillBooking] = useState(null);
  const [toast, setToast] = useState(null);

  // Reference Data
  const [buildings, setBuildings] = useState([]);
  const [batches, setBatches] = useState([]);
  const [allRooms, setAllRooms] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // --------------------------------------------------------------------------
  // UNIFIED API CLIENT (Calls real FastAPI if live, or Mock Adapter if in sandbox)
  // --------------------------------------------------------------------------
  const apiRequest = useCallback(async (method, path, body = null) => {
    // 1. Live mode attempt
    if (apiMode === 'live') {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${DEFAULT_API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(typeof data.detail === 'string' ? data.detail : 'Request failed');
        err.status = res.status;
        err.detail = data.detail;
        throw err;
      }
      return data;
    }

    // 2. Built-in Mock Adapter matching API_CONTRACT.md 100%
    await new Promise(r => setTimeout(r, 180)); // realistic latency
    const urlObj = new URL(path, 'http://localhost:8000');
    const pathname = urlObj.pathname;
    const params = urlObj.searchParams;

    // Helper for overlap check: [startA, endA) overlaps [startB, endB)
    const isOverlapping = (s1, e1, s2, e2) => s1 < e2 && s2 < e1;

    // GET /health
    if (method === 'GET' && pathname === '/health') {
      return { status: 'ok' };
    }

    // POST /auth/login
    if (method === 'POST' && pathname === '/auth/login') {
      const { email, password } = body || {};
      const user = mockDb.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
      if (!user || password !== 'demo1234') {
        const err = new Error('Invalid email or password (use demo1234 for demo accounts)');
        err.status = 401;
        err.detail = 'Invalid credentials';
        throw err;
      }
      return { token: `mock-jwt-token-${user.id}`, user };
    }

    // POST /auth/signup (student signup only)
    if (method === 'POST' && pathname === '/auth/signup') {
      const { email, name, password, batch_id } = body || {};
      if (!email || !name || !password) {
        const err = new Error('Email, name, and password are required');
        err.status = 422;
        throw err;
      }
      if (mockDb.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        const err = new Error('Email already registered');
        err.status = 422;
        throw err;
      }
      const batchObj = mockDb.batches.find(b => b.id === Number(batch_id)) || mockDb.batches[1];
      const newUser = {
        id: Date.now(),
        email,
        name,
        role: 'student',
        batch_id: batchObj.id,
        batch: batchObj,
        is_test: email.endsWith('.test')
      };
      setMockDb(prev => ({ ...prev, users: [...prev.users, newUser] }));
      return { token: `mock-jwt-token-${newUser.id}`, user: newUser };
    }

    // GET /auth/me
    if (method === 'GET' && pathname === '/auth/me') {
      if (!currentUser) {
        const err = new Error('Not authenticated');
        err.status = 401;
        throw err;
      }
      return currentUser;
    }

    // GET /buildings
    if (method === 'GET' && pathname === '/buildings') {
      return mockDb.buildings;
    }

    // GET /batches
    if (method === 'GET' && pathname === '/batches') {
      let list = [...mockDb.batches];
      if (params.get('branch')) list = list.filter(b => b.branch === params.get('branch'));
      if (params.get('year')) list = list.filter(b => b.year === Number(params.get('year')));
      return list;
    }

    // GET /rooms
    if (method === 'GET' && pathname === '/rooms') {
      let list = [...mockDb.rooms];
      if (params.get('building_id')) list = list.filter(r => r.building_id === Number(params.get('building_id')));
      if (params.get('floor') !== null && params.get('floor') !== '') list = list.filter(r => r.floor === Number(params.get('floor')));
      if (params.get('type')) list = list.filter(r => r.type === params.get('type'));
      if (params.get('min_capacity')) list = list.filter(r => r.capacity >= Number(params.get('min_capacity')));
      return list;
    }

    // PATCH /rooms/:id
    if (method === 'PATCH' && pathname.startsWith('/rooms/')) {
      const id = Number(pathname.split('/')[2]);
      let updatedRoom = null;
      setMockDb(prev => {
        const rooms = prev.rooms.map(r => {
          if (r.id === id) {
            updatedRoom = { ...r, ...body };
            return updatedRoom;
          }
          return r;
        });
        return { ...prev, rooms };
      });
      return updatedRoom || mockDb.rooms.find(r => r.id === id);
    }

    // GET /rooms/available
    if (method === 'GET' && pathname === '/rooms/available') {
      const date = params.get('date') || getTodayStr();
      const start = params.get('start') || '10:00';
      let end = params.get('end');
      const dur = Number(params.get('duration_minutes') || 60);
      if (!end) {
        const [h, m] = start.split(':').map(Number);
        const totalMins = h * 60 + m + dur;
        const eh = String(Math.floor(totalMins / 60)).padStart(2, '0');
        const em = String(totalMins % 60).padStart(2, '0');
        end = `${eh}:${em}`;
      }
      const start_at = `${date}T${start}:00`;
      const end_at = `${date}T${end}:00`;

      let candidateRooms = mockDb.rooms.filter(r => r.is_bookable);
      if (params.get('building_id')) candidateRooms = candidateRooms.filter(r => r.building_id === Number(params.get('building_id')));
      if (params.get('floor') !== null && params.get('floor') !== '') candidateRooms = candidateRooms.filter(r => r.floor === Number(params.get('floor')));
      if (params.get('type')) candidateRooms = candidateRooms.filter(r => r.type === params.get('type'));
      if (params.get('min_capacity')) candidateRooms = candidateRooms.filter(r => r.capacity >= Number(params.get('min_capacity')));
      if (params.get('purpose')) candidateRooms = candidateRooms.filter(r => r.allowed_uses.includes(params.get('purpose')));

      const freeRooms = candidateRooms.filter(r => {
        const hasClash = mockDb.bookings.some(b =>
          b.room_id === r.id &&
          b.status === 'confirmed' &&
          isOverlapping(start_at, end_at, b.start_at, b.end_at)
        );
        return !hasClash;
      });

      return { start_at, end_at, count: freeRooms.length, rooms: freeRooms };
    }

    // GET /rooms/status
    if (method === 'GET' && pathname === '/rooms/status') {
      const date = params.get('date') || getTodayStr();
      const start = params.get('start') || '10:00';
      const end = params.get('end') || '11:00';
      const start_at = `${date}T${start}:00`;
      const end_at = `${date}T${end}:00`;

      let roomsList = [...mockDb.rooms];
      if (params.get('building_id')) {
        roomsList = roomsList.filter(r => r.building_id === Number(params.get('building_id')));
      }

      return roomsList.map(r => {
        const busy_with = mockDb.bookings.filter(b =>
          b.room_id === r.id &&
          b.status === 'confirmed' &&
          isOverlapping(start_at, end_at, b.start_at, b.end_at)
        );
        return {
          ...r,
          is_free: busy_with.length === 0,
          busy_with
        };
      });
    }

    // GET /rooms/:id/schedule
    if (method === 'GET' && pathname.match(/^\/rooms\/\d+\/schedule$/)) {
      const roomId = Number(pathname.split('/')[2]);
      const date = params.get('date') || getTodayStr();
      return mockDb.bookings
        .filter(b => b.room_id === roomId && b.start_at.startsWith(date))
        .sort((a, b) => a.start_at.localeCompare(b.start_at));
    }

    // GET /recommend/slots
    if (method === 'GET' && pathname === '/recommend/slots') {
      const date = params.get('date') || getTodayStr();
      const dur = Number(params.get('duration_minutes') || 60);
      const minCap = Number(params.get('min_capacity') || 50);
      const buildingId = params.get('building_id') ? Number(params.get('building_id')) : null;
      const purpose = params.get('purpose') || 'extra_class';

      const candidateTimes = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];
      return candidateTimes.map(st => {
        const [h, m] = st.split(':').map(Number);
        const total = h * 60 + m + dur;
        const et = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        const start_at = `${date}T${st}:00`;
        const end_at = `${date}T${et}:00`;

        const availRooms = mockDb.rooms.filter(r => {
          if (!r.is_bookable) return false;
          if (r.capacity < minCap) return false;
          if (buildingId && r.building_id !== buildingId) return false;
          if (purpose && !r.allowed_uses.includes(purpose)) return false;
          const busy = mockDb.bookings.some(b =>
            b.room_id === r.id && b.status === 'confirmed' && isOverlapping(start_at, end_at, b.start_at, b.end_at)
          );
          return !busy;
        });

        return { start_at, end_at, rooms: availRooms };
      }).filter(slot => slot.rooms.length > 0);
    }

    // POST /ai/search
    if (method === 'POST' && pathname === '/ai/search') {
      if (simulateAi503) {
        const err = new Error('AI Search service key is not configured on server (503)');
        err.status = 503;
        throw err;
      }
      const q = (body?.query || '').toLowerCase();
      const capMatch = q.match(/(\d+)\s*(students|capacity|people|seats)?/);
      const min_capacity = capMatch ? Number(capMatch[1]) : 60;
      const isTomorrow = q.includes('tomorrow');
      const date = isTomorrow ? addDaysStr(getTodayStr(), 1) : getTodayStr();
      let start = '14:00';
      if (q.includes('10am') || q.includes('10 am')) start = '10:00';
      else if (q.includes('11am') || q.includes('11 am')) start = '11:00';
      else if (q.includes('2pm') || q.includes('2 pm') || q.includes('14:00')) start = '14:00';
      else if (q.includes('3pm') || q.includes('3 pm')) start = '15:00';

      const type = q.includes('lab') ? 'lab' : q.includes('seminar') ? 'seminar_hall' : 'classroom';
      const building_id = q.includes('deeksha') ? 2 : q.includes('iet') ? 1 : null;
      const start_at = `${date}T${start}:00`;
      const end_at = `${date}T${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00:00`;

      const matchingRooms = mockDb.rooms.filter(r => {
        if (!r.is_bookable) return false;
        if (r.capacity < min_capacity) return false;
        if (building_id && r.building_id !== building_id) return false;
        if (type && r.type !== type) return false;
        const clash = mockDb.bookings.some(b =>
          b.room_id === r.id && b.status === 'confirmed' && isOverlapping(start_at, end_at, b.start_at, b.end_at)
        );
        return !clash;
      });

      return {
        parsed_filters: {
          date,
          start_at,
          end_at,
          min_capacity,
          type,
          building: building_id === 1 ? 'IET' : building_id === 2 ? 'Deeksha Bhawan' : 'Any'
        },
        rooms: matchingRooms,
        verified_against_bookings: true
      };
    }

    // GET /bookings
    if (method === 'GET' && pathname === '/bookings') {
      let list = [...mockDb.bookings];
      if (params.get('mine') === 'true' && currentUser) {
        list = list.filter(b => b.booked_by.id === currentUser.id);
      }
      if (params.get('include_cancelled') !== 'true') {
        list = list.filter(b => b.status !== 'cancelled');
      }
      if (params.get('room_id')) {
        list = list.filter(b => b.room_id === Number(params.get('room_id')));
      }
      return list.sort((a, b) => b.start_at.localeCompare(a.start_at));
    }

    // POST /bookings
    if (method === 'POST' && pathname === '/bookings') {
      const { room_id, title, purpose, start_at, end_at, expected_attendees, batch_ids = [], notes } = body;
      const room = mockDb.rooms.find(r => r.id === Number(room_id));
      if (!room || !room.is_bookable) {
        const err = new Error('Selected room is not bookable');
        err.status = 422;
        throw err;
      }
      if (start_at >= end_at) {
        const err = new Error('End time must be after start time');
        err.status = 422;
        throw err;
      }
      if (!room.allowed_uses.includes(purpose)) {
        const err = new Error(`${room.name} does not permit '${purpose}'. Allowed uses: ${room.allowed_uses.join(', ')}`);
        err.status = 422;
        throw err;
      }

      const selectedBatches = mockDb.batches.filter(b => batch_ids.map(Number).includes(b.id));
      const computedAttendees = expected_attendees
        ? Number(expected_attendees)
        : selectedBatches.reduce((acc, b) => acc + b.size, 0) || 50;

      if (computedAttendees > room.capacity) {
        const err = new Error(`Expected attendees (${computedAttendees}) exceed ${room.name} capacity (${room.capacity})`);
        err.status = 422;
        throw err;
      }

      // Check 409 conflicts
      const conflicts = mockDb.bookings.filter(b =>
        b.room_id === room.id &&
        b.status === 'confirmed' &&
        isOverlapping(start_at, end_at, b.start_at, b.end_at)
      );

      if (conflicts.length > 0) {
        const alternatives = mockDb.rooms.filter(r =>
          r.is_bookable &&
          r.id !== room.id &&
          r.capacity >= computedAttendees &&
          r.allowed_uses.includes(purpose) &&
          !mockDb.bookings.some(b =>
            b.room_id === r.id &&
            b.status === 'confirmed' &&
            isOverlapping(start_at, end_at, b.start_at, b.end_at)
          )
        ).slice(0, 6);

        const err = new Error(`${room.name} is already booked at that time`);
        err.status = 409;
        err.detail = {
          message: `${room.name} is already booked at that time`,
          conflicts,
          alternatives
        };
        throw err;
      }

      const newBooking = {
        id: Date.now(),
        room_id: room.id,
        room: { id: room.id, name: room.name, building: room.building, floor: room.floor },
        title,
        purpose,
        start_at,
        end_at,
        status: 'confirmed',
        expected_attendees: computedAttendees,
        booked_by: { id: currentUser?.id || 2, name: currentUser?.name || 'Dr. R. K. Pandey (test)' },
        batches: selectedBatches.map(b => ({ id: b.id, label: b.label })),
        notes: notes || null,
        is_test: Boolean(currentUser?.is_test)
      };

      const newAudit = {
        id: Date.now() + 1,
        entity: 'booking',
        entity_id: newBooking.id,
        action: 'created',
        actor: newBooking.booked_by.name,
        timestamp: new Date().toISOString().slice(0, 19),
        old_value: null,
        new_value: { room: room.name, start_at, end_at, purpose, expected_attendees: computedAttendees },
        is_test: newBooking.is_test
      };

      setMockDb(prev => ({
        ...prev,
        bookings: [newBooking, ...prev.bookings],
        audits: [newAudit, ...prev.audits]
      }));

      return newBooking;
    }

    // POST /bookings/:id/cancel
    if (method === 'POST' && pathname.match(/^\/bookings\/\d+\/cancel$/)) {
      const bookingId = Number(pathname.split('/')[2]);
      const reason = body?.reason || 'Cancelled by faculty';
      const target = mockDb.bookings.find(b => b.id === bookingId);
      if (!target) {
        const err = new Error('Booking not found');
        err.status = 404;
        throw err;
      }

      const updated = { ...target, status: 'cancelled', notes: `${target.notes ? target.notes + ' | ' : ''}Cancelled: ${reason}` };
      const autoAnnouncement = {
        id: Date.now(),
        title: `Cancelled: ${target.title} (${target.room.name})`,
        body: `Class/Booking "${target.title}" scheduled in ${target.room.name} (${formatDateReadable(target.start_at)} ${formatTimeShort(target.start_at)}–${formatTimeShort(target.end_at)}) has been cancelled. Reason: ${reason}`,
        kind: 'cancellation',
        booking_id: bookingId,
        created_at: new Date().toISOString().slice(0, 19),
        author: currentUser?.name || target.booked_by.name,
        batches: target.batches.map(b => b.label),
        is_test: target.is_test
      };
      const auditEntry = {
        id: Date.now() + 2,
        entity: 'booking',
        entity_id: bookingId,
        action: 'cancelled',
        actor: currentUser?.name || target.booked_by.name,
        timestamp: new Date().toISOString().slice(0, 19),
        old_value: { status: 'confirmed' },
        new_value: { status: 'cancelled', reason },
        is_test: target.is_test
      };

      setMockDb(prev => ({
        ...prev,
        bookings: prev.bookings.map(b => b.id === bookingId ? updated : b),
        announcements: [autoAnnouncement, ...prev.announcements],
        audits: [auditEntry, ...prev.audits]
      }));
      return updated;
    }

    // PATCH /bookings/:id (Reschedule with 409 check)
    if (method === 'PATCH' && pathname.match(/^\/bookings\/\d+$/)) {
      const bookingId = Number(pathname.split('/')[2]);
      const target = mockDb.bookings.find(b => b.id === bookingId);
      if (!target) {
        const err = new Error('Booking not found');
        err.status = 404;
        throw err;
      }

      const newRoomId = body.room_id ? Number(body.room_id) : target.room_id;
      const room = mockDb.rooms.find(r => r.id === newRoomId);
      const start_at = body.start_at || target.start_at;
      const end_at = body.end_at || target.end_at;
      const reason = body.reason || 'Schedule updated';

      const conflicts = mockDb.bookings.filter(b =>
        b.id !== bookingId &&
        b.room_id === room.id &&
        b.status === 'confirmed' &&
        isOverlapping(start_at, end_at, b.start_at, b.end_at)
      );

      if (conflicts.length > 0) {
        const alternatives = mockDb.rooms.filter(r =>
          r.is_bookable &&
          r.id !== room.id &&
          r.capacity >= target.expected_attendees &&
          r.allowed_uses.includes(target.purpose) &&
          !mockDb.bookings.some(b =>
            b.id !== bookingId &&
            b.room_id === r.id &&
            b.status === 'confirmed' &&
            isOverlapping(start_at, end_at, b.start_at, b.end_at)
          )
        ).slice(0, 6);

        const err = new Error(`${room.name} is already booked at that time`);
        err.status = 409;
        err.detail = {
          message: `${room.name} is already booked at that time`,
          conflicts,
          alternatives
        };
        throw err;
      }

      const updated = {
        ...target,
        room_id: room.id,
        room: { id: room.id, name: room.name, building: room.building, floor: room.floor },
        start_at,
        end_at
      };

      const autoAnnouncement = {
        id: Date.now(),
        title: `Rescheduled: ${target.title} -> ${room.name}`,
        body: `"${target.title}" has been moved to ${room.name} at ${formatDateReadable(start_at)} ${formatTimeShort(start_at)}–${formatTimeShort(end_at)}. Note: ${reason}`,
        kind: 'reschedule',
        booking_id: bookingId,
        created_at: new Date().toISOString().slice(0, 19),
        author: currentUser?.name || target.booked_by.name,
        batches: target.batches.map(b => b.label),
        is_test: target.is_test
      };

      const auditEntry = {
        id: Date.now() + 3,
        entity: 'booking',
        entity_id: bookingId,
        action: 'rescheduled',
        actor: currentUser?.name || target.booked_by.name,
        timestamp: new Date().toISOString().slice(0, 19),
        old_value: { room: target.room.name, start_at: target.start_at, end_at: target.end_at },
        new_value: { room: room.name, start_at, end_at, reason },
        is_test: target.is_test
      };

      setMockDb(prev => ({
        ...prev,
        bookings: prev.bookings.map(b => b.id === bookingId ? updated : b),
        announcements: [autoAnnouncement, ...prev.announcements],
        audits: [auditEntry, ...prev.audits]
      }));
      return updated;
    }

    // GET /me/schedule & GET /batches/:id/schedule
    if (method === 'GET' && (pathname === '/me/schedule' || pathname.match(/^\/batches\/\d+\/schedule$/))) {
      const batchId = pathname === '/me/schedule'
        ? (currentUser?.batch_id || 2)
        : Number(pathname.split('/')[2]);
      return mockDb.bookings
        .filter(b => b.batches.some(bt => bt.id === batchId))
        .sort((a, b) => a.start_at.localeCompare(b.start_at));
    }

    // POST /reports & GET /reports & PATCH /reports/:id
    if (method === 'POST' && pathname === '/reports') {
      const targetBooking = mockDb.bookings.find(b => b.id === Number(body.booking_id));
      const newReport = {
        id: Date.now(),
        kind: body.kind || 'comment',
        text: body.text,
        booking_id: body.booking_id || null,
        booking_title: targetBooking ? `${targetBooking.title} (${targetBooking.room.name})` : 'General Schedule Feedback',
        status: 'open',
        created_by: { id: currentUser?.id || 3, name: currentUser?.name || 'Student', role: currentUser?.role || 'student' },
        created_at: new Date().toISOString().slice(0, 19),
        is_test: Boolean(currentUser?.is_test)
      };
      setMockDb(prev => ({ ...prev, reports: [newReport, ...prev.reports] }));
      return newReport;
    }

    if (method === 'GET' && pathname === '/reports') {
      let list = [...mockDb.reports];
      if (currentUser?.role === 'student') {
        list = list.filter(r => r.created_by.id === currentUser.id);
      }
      if (params.get('status')) {
        list = list.filter(r => r.status === params.get('status'));
      }
      return list;
    }

    if (method === 'PATCH' && pathname.match(/^\/reports\/\d+$/)) {
      const repId = Number(pathname.split('/')[2]);
      let updated = null;
      setMockDb(prev => ({
        ...prev,
        reports: prev.reports.map(r => {
          if (r.id === repId) {
            updated = { ...r, status: body.status };
            return updated;
          }
          return r;
        })
      }));
      return updated;
    }

    // GET /announcements & POST /announcements
    if (method === 'GET' && pathname === '/announcements') {
      let list = [...mockDb.announcements];
      if (params.get('kind')) list = list.filter(a => a.kind === params.get('kind'));
      return list;
    }

    if (method === 'POST' && pathname === '/announcements') {
      const item = {
        id: Date.now(),
        title: body.title,
        body: body.body,
        kind: body.kind || 'general',
        booking_id: body.booking_id || null,
        created_at: new Date().toISOString().slice(0, 19),
        author: currentUser?.name || 'Faculty',
        batches: [],
        is_test: Boolean(currentUser?.is_test)
      };
      setMockDb(prev => ({ ...prev, announcements: [item, ...prev.announcements] }));
      return item;
    }

    // GET /audit
    if (method === 'GET' && pathname === '/audit') {
      const entityId = Number(params.get('entity_id'));
      return mockDb.audits.filter(a => !entityId || a.entity_id === entityId);
    }

    // POST /admin/users
    if (method === 'POST' && pathname === '/admin/users') {
      const { email, name, password, role } = body;
      if (!email || !name || !password) {
        const err = new Error('All fields are required');
        err.status = 422;
        throw err;
      }
      const created = {
        id: Date.now(),
        email,
        name,
        role: role || 'faculty',
        batch_id: null,
        batch: null,
        is_test: email.endsWith('.test')
      };
      setMockDb(prev => ({ ...prev, users: [...prev.users, created] }));
      return created;
    }

    return {};
  }, [apiMode, token, mockDb, currentUser, simulateAi503]);

  // --------------------------------------------------------------------------
  // INITIAL HEALTH CHECK & REFERENCE DATA LOAD
  // --------------------------------------------------------------------------
  const checkBackendHealth = useCallback(async () => {
    setWakingUpServer(true);
    setApiMode('checking');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(`${DEFAULT_API_URL}/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        setApiMode('live');
      } else {
        setApiMode('mock');
      }
    } catch {
      // Fallback to built-in Mock API Adapter when localhost:8000 is not running
      setApiMode('mock');
    } finally {
      setWakingUpServer(false);
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  const loadReferenceData = useCallback(async () => {
    if (apiMode === 'checking') return;
    try {
      const [bData, btData, rData] = await Promise.all([
        apiRequest('GET', '/buildings'),
        apiRequest('GET', '/batches'),
        apiRequest('GET', '/rooms')
      ]);
      setBuildings(bData || []);
      setBatches(btData || []);
      setAllRooms(rData || []);
    } catch (e) {
      console.error('Reference data load error:', e);
    }
  }, [apiMode, apiRequest]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Role-based default tab adjustment
  useEffect(() => {
    if (currentUser?.role === 'student' && (activeTab === 'book_form' || activeTab === 'my_bookings' || activeTab === 'admin')) {
      setActiveTab('student_schedule');
    }
  }, [currentUser, activeTab]);

  const handleLoginSuccess = (newToken, userObj) => {
    setToken(newToken);
    setCurrentUser(userObj);
    localStorage.setItem('ddu_campus_token', newToken);
    localStorage.setItem('ddu_campus_user', JSON.stringify(userObj));
    if (userObj.role === 'student') {
      setActiveTab('student_schedule');
    } else {
      setActiveTab('find_room');
    }
    showToast(`Welcome back, ${userObj.name}!`, 'success');
  };

  const handleLogout = () => {
    setToken('');
    setCurrentUser(null);
    localStorage.removeItem('ddu_campus_token');
    localStorage.removeItem('ddu_campus_user');
    showToast('Logged out of Smart Campus System', 'info');
  };

  const handleQuickBookFromRoom = (room, date, start, end, purpose = 'extra_class') => {
    setPrefillBooking({
      room_id: room.id,
      date: date || getTodayStr(),
      start: start || '10:00',
      end: end || '11:00',
      purpose
    });
    setActiveTab('book_form');
  };

  // Navigation items strictly filtered by user role
  const navItems = useMemo(() => {
    if (!currentUser) return [];
    const role = currentUser.role;
    const items = [
      { id: 'find_room', label: 'Find a Room', icon: Search, roles: ['student', 'faculty', 'admin'] },
      { id: 'floor_map', label: 'Floor Map', icon: Map, roles: ['student', 'faculty', 'admin'] },
      { id: 'book_form', label: 'Book a Room', icon: Plus, roles: ['faculty', 'admin'] },
      { id: 'my_bookings', label: 'My Bookings', icon: Calendar, roles: ['faculty', 'admin'] },
      { id: 'student_schedule', label: role === 'student' ? 'My Schedule' : 'Batch Schedules', icon: BookOpen, roles: ['student', 'faculty', 'admin'] },
      { id: 'announcements', label: 'Announcements', icon: Bell, roles: ['student', 'faculty', 'admin'] },
      { id: 'admin', label: 'Admin Panel', icon: Settings, roles: ['admin'] }
    ];
    return items.filter(item => item.roles.includes(role));
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top University System Banner */}
      <div className="bg-slate-900 text-slate-200 text-xs py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-400">DDU GU</span>
            <span>• Deen Dayal Upadhyaya Gorakhpur University — Smart Campus Classroom Management</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <span className={`w-2 h-2 rounded-full ${apiMode === 'live' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {apiMode === 'live' ? `Live API (${DEFAULT_API_URL})` : 'Interactive Preview API (Mock Mode)'}
            </span>
            <button
              onClick={checkBackendHealth}
              className="hover:text-white underline flex items-center gap-1 text-[11px]"
              title="Retry connecting to localhost:8000"
            >
              <RefreshCw className="w-3 h-3" /> Check Server
            </button>
          </div>
        </div>
      </div>

      {/* Friendly Free-Tier Server Wakeup Banner */}
      {wakingUpServer && (
        <div className="bg-indigo-600 text-white px-4 py-3 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm font-medium">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Waking up the server... (The backend runs on a free host that can take up to a minute to wake up)</span>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-bounce">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border ${
            toast.type === 'error' ? 'bg-red-900 text-white border-red-700' :
            toast.type === 'info' ? 'bg-slate-800 text-white border-slate-700' :
            'bg-emerald-900 text-white border-emerald-700'
          }`}>
            {toast.type === 'error' ? <XCircle className="w-5 h-5 text-red-300 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-xs opacity-75 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* Main Header & Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-900 text-white flex items-center justify-center font-bold shadow">
              <Building2 className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Smart Campus Classroom System
              </h1>
              <p className="text-xs text-slate-500">
                IET & Deeksha Bhawan • Real-Time Room & Schedule Portal
              </p>
            </div>
          </div>

          {currentUser && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <UserCheck className="w-4 h-4 text-indigo-700" />
                <div className="text-xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    {currentUser.name}
                    <TestDataBadge show={currentUser.is_test} />
                  </div>
                  <div className="text-slate-500 capitalize">
                    Role: <span className="font-semibold text-indigo-700">{currentUser.role}</span>
                    {currentUser.batch?.label ? ` • ${currentUser.batch.label}` : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Role-Appropriate Navigation Tabs */}
        {currentUser && (
          <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
            <nav className="flex items-center gap-1 border-t border-slate-100 pt-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                      active
                        ? 'border-indigo-700 text-indigo-800 bg-indigo-50/60'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-indigo-700' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {!currentUser ? (
          <AuthScreen
            apiRequest={apiRequest}
            batches={batches}
            onLoginSuccess={handleLoginSuccess}
            showToast={showToast}
          />
        ) : (
          <>
            {activeTab === 'find_room' && (
              <FindRoomPage
                apiRequest={apiRequest}
                buildings={buildings}
                currentUser={currentUser}
                onSelectRoomToBook={handleQuickBookFromRoom}
                simulateAi503={simulateAi503}
                setSimulateAi503={setSimulateAi503}
                apiMode={apiMode}
                showToast={showToast}
              />
            )}
            {activeTab === 'floor_map' && (
              <FloorMapPage
                apiRequest={apiRequest}
                buildings={buildings}
                currentUser={currentUser}
                onSelectRoomToBook={handleQuickBookFromRoom}
                showToast={showToast}
              />
            )}
            {activeTab === 'book_form' && (currentUser.role === 'faculty' || currentUser.role === 'admin') && (
              <BookRoomPage
                apiRequest={apiRequest}
                allRooms={allRooms}
                batches={batches}
                prefill={prefillBooking}
                onBooked={() => {
                  setPrefillBooking(null);
                  setActiveTab('my_bookings');
                }}
                showToast={showToast}
              />
            )}
            {activeTab === 'my_bookings' && (currentUser.role === 'faculty' || currentUser.role === 'admin') && (
              <MyBookingsPage
                apiRequest={apiRequest}
                allRooms={allRooms}
                showToast={showToast}
              />
            )}
            {activeTab === 'student_schedule' && (
              <StudentSchedulePage
                apiRequest={apiRequest}
                currentUser={currentUser}
                batches={batches}
                showToast={showToast}
              />
            )}
            {activeTab === 'announcements' && (
              <AnnouncementsPage
                apiRequest={apiRequest}
                currentUser={currentUser}
                showToast={showToast}
              />
            )}
            {activeTab === 'admin' && currentUser.role === 'admin' && (
              <AdminDashboardPage
                apiRequest={apiRequest}
                allRooms={allRooms}
                onRoomsUpdated={loadReferenceData}
                showToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            Deen Dayal Upadhyaya Gorakhpur University • Smart Campus Classroom Management System
          </div>
          <div className="flex items-center gap-4">
            <span>All times in Campus Local Time (IST)</span>
            <TestDataBadge show={true} />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// 1. LOGIN & STUDENT SIGNUP PAGE
// ============================================================================
function AuthScreen({ apiRequest, batches, onLoginSuccess, showToast }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('faculty@demo.test');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [batchId, setBatchId] = useState(batches[1]?.id || 2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiRequest('POST', '/auth/login', { email, password });
        onLoginSuccess(res.token, res.user);
      } else {
        const res = await apiRequest('POST', '/auth/signup', {
          email,
          name,
          password,
          batch_id: Number(batchId)
        });
        onLoginSuccess(res.token, res.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const quickDemoLogin = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword('demo1234');
    setMode('login');
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/auth/login', { email: demoEmail, password: 'demo1234' });
      onLoginSuccess(res.token, res.user);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto grid md:grid-cols-5 gap-6 items-start pt-4">
      {/* Left column: University Info & 1-click Demo Accounts */}
      <div className="md:col-span-3 bg-indigo-950 text-white rounded-2xl p-6 shadow-lg border border-indigo-800">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-800 text-amber-300 text-xs font-semibold mb-4">
          <Building2 className="w-4 h-4" />
          Deen Dayal Upadhyaya Gorakhpur University
        </div>
        <h2 className="text-2xl font-bold mb-2">Smart Classroom & Lecture Hall Portal</h2>
        <p className="text-indigo-200 text-sm mb-6 leading-relaxed">
          Real-time room availability, interactive floor maps for IET and Deeksha Bhawan, clash-free faculty booking with instant alternatives, and live student batch schedules.
        </p>

        <div className="bg-indigo-900/70 rounded-xl p-4 border border-indigo-700/80 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              One-Click Demo Accounts (Password: demo1234)
            </span>
            <TestDataBadge show={true} />
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => quickDemoLogin('faculty@demo.test')}
              className="text-left p-3 rounded-lg bg-indigo-800/90 hover:bg-indigo-700 border border-indigo-600 transition group"
            >
              <div className="font-bold text-sm text-white group-hover:text-amber-300 flex items-center justify-between">
                Faculty Demo <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] text-indigo-200 truncate">faculty@demo.test</div>
              <div className="text-[10px] text-amber-300 mt-1">Book, Reschedule, AI Search</div>
            </button>

            <button
              type="button"
              onClick={() => quickDemoLogin('student@demo.test')}
              className="text-left p-3 rounded-lg bg-indigo-800/90 hover:bg-indigo-700 border border-indigo-600 transition group"
            >
              <div className="font-bold text-sm text-white group-hover:text-amber-300 flex items-center justify-between">
                Student Demo <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] text-indigo-200 truncate">student@demo.test</div>
              <div className="text-[10px] text-emerald-300 mt-1">CSE Yr 2 Sec A • Schedule</div>
            </button>

            <button
              type="button"
              onClick={() => quickDemoLogin('admin@demo.test')}
              className="text-left p-3 rounded-lg bg-indigo-800/90 hover:bg-indigo-700 border border-indigo-600 transition group"
            >
              <div className="font-bold text-sm text-white group-hover:text-amber-300 flex items-center justify-between">
                Admin Demo <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] text-indigo-200 truncate">admin@demo.test</div>
              <div className="text-[10px] text-purple-300 mt-1">Manage Rooms, Reports, Users</div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-indigo-200">
          <div className="bg-indigo-900/40 p-3 rounded-lg border border-indigo-800">
            <span className="font-bold text-white block mb-0.5">IET Building</span>
            Ground, First & Second Floors (Classrooms, Programming Labs & Seminar Hall IET32)
          </div>
          <div className="bg-indigo-900/40 p-3 rounded-lg border border-indigo-800">
            <span className="font-bold text-white block mb-0.5">Deeksha Bhawan</span>
            Ground (LH01–LH07) & First Floor (LH08–LH14) High-Capacity Lecture Halls
          </div>
        </div>
      </div>

      {/* Right column: Login / Student Signup Form */}
      <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="flex rounded-lg bg-slate-100 p-1 mb-5">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition ${
              mode === 'login' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition ${
              mode === 'signup' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Student Signup
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name (Student)</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Priya Srivastava"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">University Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@ddugu.ac.in"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Your Batch</label>
              <select
                value={batchId}
                onChange={e => setBatchId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.size} students)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Self-registration creates a Student account. Faculty accounts are provisioned by Admin.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow transition"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login to Portal' : 'Create Student Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 2. FIND A ROOM PAGE (Filters + Available Rooms + Recommended Slots + AI Search)
// ============================================================================
function FindRoomPage({
  apiRequest,
  buildings,
  currentUser,
  onSelectRoomToBook,
  simulateAi503,
  setSimulateAi503,
  apiMode,
  showToast
}) {
  const [buildingId, setBuildingId] = useState('');
  const [floor, setFloor] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [start, setStart] = useState('10:00');
  const [useDuration, setUseDuration] = useState(false);
  const [end, setEnd] = useState('11:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [minCapacity, setMinCapacity] = useState('');
  const [roomType, setRoomType] = useState('');
  const [purpose, setPurpose] = useState('');

  const [results, setResults] = useState([]);
  const [timeWindow, setTimeWindow] = useState({ start_at: '', end_at: '' });
  const [loading, setLoading] = useState(false);

  // Recommended slots state
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendedSlots, setRecommendedSlots] = useState([]);

  // AI Natural Language Search state (Faculty/Admin only)
  const [aiQuery, setAiQuery] = useState('room for 70 students tomorrow 2pm for 1 hour');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiHidden503, setAiHidden503] = useState(false);

  const canBook = currentUser.role === 'faculty' || currentUser.role === 'admin';

  const fetchAvailableRooms = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ date, start });
      if (useDuration) q.set('duration_minutes', String(durationMinutes));
      else q.set('end', end);
      if (buildingId) q.set('building_id', buildingId);
      if (floor !== '') q.set('floor', floor);
      if (minCapacity) q.set('min_capacity', minCapacity);
      if (roomType) q.set('type', roomType);
      if (purpose) q.set('purpose', purpose);

      const data = await apiRequest('GET', `/rooms/available?${q.toString()}`);
      setResults(data.rooms || []);
      setTimeWindow({ start_at: data.start_at, end_at: data.end_at });
    } catch (e) {
      showToast(e.message || 'Failed to fetch available rooms', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, date, start, useDuration, durationMinutes, end, buildingId, floor, minCapacity, roomType, purpose, showToast]);

  useEffect(() => {
    fetchAvailableRooms();
  }, [fetchAvailableRooms]);

  const handleLoadRecommendedSlots = async () => {
    setShowRecommendations(true);
    try {
      const q = new URLSearchParams({
        date,
        duration_minutes: String(durationMinutes || 60),
        min_capacity: String(minCapacity || 60)
      });
      if (buildingId) q.set('building_id', buildingId);
      if (purpose) q.set('purpose', purpose);
      const slots = await apiRequest('GET', `/recommend/slots?${q.toString()}`);
      setRecommendedSlots(slots || []);
    } catch (e) {
      showToast('Could not load recommended slots', 'error');
    }
  };

  const handleAiSearch = async (e) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const res = await apiRequest('POST', '/ai/search', { query: aiQuery });
      setAiResult(res);
    } catch (err) {
      if (err.status === 503) {
        setAiHidden503(true);
        showToast('AI Search unavailable (503) — hiding AI search box gracefully', 'info');
      } else {
        showToast(err.message || 'AI search error', 'error');
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Faculty/Admin "Ask in plain English" AI Search Box */}
      {canBook && !aiHidden503 && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-5 text-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm sm:text-base">Ask in Plain English (Faculty AI Room Finder)</h3>
            </div>
            {apiMode === 'mock' && (
              <label className="flex items-center gap-1.5 text-[11px] text-indigo-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateAi503}
                  onChange={e => setSimulateAi503(e.target.checked)}
                  className="rounded"
                />
                Simulate HTTP 503 (Test graceful hide)
              </label>
            )}
          </div>
          <form onSubmit={handleAiSearch} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              placeholder='e.g., "room for 70 students tomorrow 2pm for 1 hour"'
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-indigo-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm rounded-xl transition shrink-0"
            >
              {aiLoading ? 'Searching...' : 'AI Search'}
            </button>
          </form>

          {aiResult && (
            <div className="mt-4 bg-white/10 rounded-xl p-4 border border-white/15">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 mb-3">
                <span>
                  Parsed Filters: Date <strong>{aiResult.parsed_filters?.date}</strong> • Time <strong>{formatTimeShort(aiResult.parsed_filters?.start_at)}–{formatTimeShort(aiResult.parsed_filters?.end_at)}</strong> • Min Cap <strong>{aiResult.parsed_filters?.min_capacity}</strong> • Type <strong>{aiResult.parsed_filters?.type}</strong>
                </span>
                {aiResult.verified_against_bookings && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified against live bookings
                  </span>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-2.5">
                {aiResult.rooms.slice(0, 6).map(r => (
                  <div key={r.id} className="bg-slate-900/80 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">{r.name} <span className="text-xs font-normal text-indigo-300">({r.building})</span></div>
                      <div className="text-xs text-slate-300">
                        Cap: {r.capacity} {r.capacity_assumed && '(capacity assumed)'}
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectRoomToBook(
                        r,
                        aiResult.parsed_filters?.date,
                        formatTimeShort(aiResult.parsed_filters?.start_at),
                        formatTimeShort(aiResult.parsed_filters?.end_at)
                      )}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg"
                    >
                      Book
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aiHidden503 && canBook && (
        <div className="flex items-center justify-between bg-slate-100 px-4 py-2 rounded-lg text-xs text-slate-600 border border-slate-200">
          <span>AI Search box hidden because `/ai/search` returned HTTP 503 (AI key not configured).</span>
          <button
            onClick={() => { setSimulateAi503(false); setAiHidden503(false); }}
            className="text-indigo-700 font-semibold underline"
          >
            Re-enable AI Search Box
          </button>
        </div>
      )}

      {/* Standard Filter Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-700" />
            Filter Available Classrooms & Labs
          </h2>
          <button
            type="button"
            onClick={handleLoadRecommendedSlots}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200"
          >
            Suggest Best Time Slots (/recommend/slots)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Building</label>
            <select
              value={buildingId}
              onChange={e => setBuildingId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Buildings (IET & Deeksha)</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Floor</label>
            <select
              value={floor}
              onChange={e => setFloor(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Any Floor</option>
              <option value="0">Ground Floor (Floor 0)</option>
              <option value="1">First Floor (Floor 1)</option>
              <option value="2">Second Floor (Floor 2 - IET)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Start Time (IST)</label>
            <input
              type="time"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
              <span>{useDuration ? 'Duration (Minutes)' : 'End Time (IST)'}</span>
              <button
                type="button"
                onClick={() => setUseDuration(!useDuration)}
                className="text-[11px] text-indigo-600 underline"
              >
                Use {useDuration ? 'End Time' : 'Duration'}
              </button>
            </div>
            {useDuration ? (
              <select
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value={45}>45 mins</option>
                <option value={60}>60 mins (1 hour)</option>
                <option value={90}>90 mins (1.5 hours)</option>
                <option value={120}>120 mins (2 hours)</option>
              </select>
            ) : (
              <input
                type="time"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Minimum Capacity</label>
            <input
              type="number"
              placeholder="e.g., 70"
              value={minCapacity}
              onChange={e => setMinCapacity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Room Type</label>
            <select
              value={roomType}
              onChange={e => setRoomType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Types</option>
              {ROOM_TYPES.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Purpose</label>
            <select
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Any Allowed Purpose</option>
              {PURPOSES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Optional Recommended Slots Panel */}
      {showRecommendations && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-indigo-950">
              Recommended Start Times on {formatDateReadable(date)}
            </h3>
            <button onClick={() => setShowRecommendations(false)} className="text-xs text-slate-500 hover:text-slate-800">Close ✕</button>
          </div>
          <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {recommendedSlots.map((slot, i) => (
              <div key={i} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-indigo-900">
                    {formatTimeShort(slot.start_at)} – {formatTimeShort(slot.end_at)}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    {slot.rooms.length} free rooms
                  </div>
                </div>
                <button
                  onClick={() => {
                    setStart(formatTimeShort(slot.start_at));
                    setEnd(formatTimeShort(slot.end_at));
                    setUseDuration(false);
                    setShowRecommendations(false);
                  }}
                  className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded text-xs font-semibold"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700">
            {loading ? 'Checking availability...' : `Available Rooms (${results.length})`}
            {timeWindow.start_at && (
              <span className="font-normal text-slate-500 ml-2">
                for {formatDateReadable(timeWindow.start_at)} • {formatTimeShort(timeWindow.start_at)} to {formatTimeShort(timeWindow.end_at)}
              </span>
            )}
          </h3>
        </div>

        {results.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
            <DoorOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No free rooms match your criteria</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting minimum capacity, room type, or time window.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(room => (
              <div
                key={room.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:border-indigo-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-base font-bold text-slate-900">{room.name}</span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {room.building} • Floor {room.floor === 0 ? 'G' : room.floor}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Free
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 mb-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Capacity: <strong className="text-slate-900">{room.capacity}</strong></span>
                      <CapacityAssumedBadge assumed={room.capacity_assumed} />
                    </div>
                    <div className="capitalize">
                      Type: <strong className="text-slate-800">{room.type.replace('_', ' ')}</strong>
                    </div>
                    {room.notes && (
                      <div className="text-[11px] text-slate-500 italic">{room.notes}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {room.allowed_uses?.map(u => (
                      <span key={u} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {u.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                {canBook && (
                  <button
                    onClick={() => onSelectRoomToBook(
                      room,
                      date,
                      formatTimeShort(timeWindow.start_at) || start,
                      formatTimeShort(timeWindow.end_at) || end,
                      purpose || room.allowed_uses?.[0] || 'extra_class'
                    )}
                    className="w-full py-2 px-3 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Book {room.name}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 3. INTERACTIVE BLUEPRINT FLOOR MAP PAGE (IET 3 Floors & Deeksha 2 Floors)
// ============================================================================
function FloorMapPage({ apiRequest, currentUser, onSelectRoomToBook, showToast }) {
  const [selectedBuilding, setSelectedBuilding] = useState('IET'); // 'IET' | 'DEEKSHA'
  const [date, setDate] = useState(getTodayStr());
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(false);

  // Selected room for day schedule side-panel
  const [inspectedRoom, setInspectedRoom] = useState(null);
  const [roomDaySchedule, setRoomDaySchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const canBook = currentUser.role === 'faculty' || currentUser.role === 'admin';

  const loadFloorStatus = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ date, start, end });
      const data = await apiRequest('GET', `/rooms/status?${q.toString()}`);
      const map = {};
      (data || []).forEach(r => {
        map[r.name] = r;
      });
      setStatusMap(map);
    } catch (e) {
      showToast('Failed to load floor map room statuses', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, date, start, end, showToast]);

  useEffect(() => {
    loadFloorStatus();
  }, [loadFloorStatus]);

  const handleRoomClick = async (roomName) => {
    const roomObj = statusMap[roomName];
    if (!roomObj) return;
    setInspectedRoom(roomObj);
    setScheduleLoading(true);
    try {
      const sched = await apiRequest('GET', `/rooms/${roomObj.id}/schedule?date=${date}`);
      setRoomDaySchedule(sched || []);
    } catch {
      setRoomDaySchedule([]);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Blueprint layout definition strictly matching FRONTEND_PROMPT.md
  const ietBlueprint = [
    {
      floorLabel: 'Second Floor (Floor 2)',
      floorNum: 2,
      rows: [
        ['IET32', 'IET24', 'IET25'], // Top row: IET32 (seminar hall), 24, 25
        ['IET30', 'IET29', 'IET28', 'IET23'] // Bottom row: IET30, 29, 28, 23
      ]
    },
    {
      floorLabel: 'First Floor (Floor 1)',
      floorNum: 1,
      rows: [
        ['IET22', 'IET16', 'IET14', 'IET15'], // Top row: IET22, 16, 14, 15
        ['IET20', 'IET19', 'IET18', 'IET17'] // Bottom row: IET20, 19, 18, 17
      ]
    },
    {
      floorLabel: 'Ground Floor (Floor 0)',
      floorNum: 0,
      rows: [
        ['Library', "Teachers' Office", 'Placement Cell', 'Director Office']
      ]
    }
  ];

  const deekshaBlueprint = [
    {
      floorLabel: 'First Floor (Floor 1)',
      floorNum: 1,
      rows: [
        ['LH08', 'LH09', 'LH10', 'LH11', 'LH12', 'LH13', 'LH14']
      ]
    },
    {
      floorLabel: 'Ground Floor (Floor 0)',
      floorNum: 0,
      rows: [
        ['LH01', 'LH02', 'LH03', 'LH04', 'LH05', 'LH06', 'LH07']
      ]
    }
  ];

  const activeBlueprint = selectedBuilding === 'IET' ? ietBlueprint : deekshaBlueprint;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setSelectedBuilding('IET'); setInspectedRoom(null); }}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition ${
              selectedBuilding === 'IET'
                ? 'bg-indigo-900 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            IET Building (3 Floors)
          </button>
          <button
            onClick={() => { setSelectedBuilding('DEEKSHA'); setInspectedRoom(null); }}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition ${
              selectedBuilding === 'DEEKSHA'
                ? 'bg-indigo-900 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Deeksha Bhawan (2 Floors)
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">From</label>
            <input
              type="time"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">To</label>
            <input
              type="time"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-3 text-xs pl-2 py-1.5">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Free
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-800">
              <span className="w-3 h-3 rounded bg-red-500 inline-block" /> Busy
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid & Side Schedule Drawer */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {activeBlueprint.map(floorObj => (
            <div key={floorObj.floorNum} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-700" />
                  {selectedBuilding === 'IET' ? 'IET' : 'Deeksha Bhawan'} — {floorObj.floorLabel}
                </h3>
                <span className="text-[11px] text-slate-400">Click any room box for day schedule</span>
              </div>

              <div className="space-y-4">
                {floorObj.rows.map((row, rIdx) => (
                  <div key={rIdx}>
                    {rIdx === 1 && (
                      <div className="text-center text-[10px] uppercase tracking-widest text-slate-400 py-1 my-1 bg-slate-50 rounded border border-dashed border-slate-200">
                        Central Corridor / Walkway
                      </div>
                    )}
                    <div className={`grid gap-3 ${
                      row.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                      row.length === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                      'grid-cols-2 sm:grid-cols-4 md:grid-cols-7'
                    }`}>
                      {row.map(roomName => {
                        const r = statusMap[roomName];
                        if (!r) return null;
                        const isFree = r.is_free;
                        const isSelected = inspectedRoom?.id === r.id;
                        return (
                          <button
                            key={roomName}
                            type="button"
                            onClick={() => handleRoomClick(roomName)}
                            className={`text-left p-3 rounded-xl border-2 transition relative flex flex-col justify-between min-h-[96px] ${
                              isFree
                                ? 'bg-emerald-50/90 hover:bg-emerald-100 border-emerald-400 text-emerald-950'
                                : 'bg-red-50/90 hover:bg-red-100 border-red-400 text-red-950'
                            } ${isSelected ? 'ring-4 ring-indigo-500/40' : ''}`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-extrabold text-sm">{r.name}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  isFree ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                                }`}>
                                  {isFree ? 'Free' : 'Busy'}
                                </span>
                              </div>
                              <div className="text-[11px] opacity-80 capitalize mt-0.5">
                                {r.type.replace('_', ' ')}
                              </div>
                            </div>

                            <div className="mt-2 pt-1.5 border-t border-black/10 text-[11px]">
                              <div>
                                Cap: <strong>{r.capacity}</strong>
                                {r.capacity_assumed && <span className="italic opacity-75"> (assumed)</span>}
                              </div>
                              {!isFree && r.busy_with?.[0] && (
                                <div className="truncate font-semibold text-red-900 mt-0.5" title={r.busy_with[0].title}>
                                  • {r.busy_with[0].title}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Room Day Schedule Inspector Panel */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 sticky top-24">
          {!inspectedRoom ? (
            <div className="text-center py-10 text-slate-400">
              <Map className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-600">Select a Room on the Blueprint</p>
              <p className="text-xs mt-1">Click any green or red room box to inspect its full schedule for {formatDateReadable(date)}.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 mb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{inspectedRoom.name}</h3>
                  <p className="text-xs text-slate-500">
                    {inspectedRoom.building} • Floor {inspectedRoom.floor} • <span className="capitalize">{inspectedRoom.type.replace('_', ' ')}</span>
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  inspectedRoom.is_free ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {inspectedRoom.is_free ? 'Available Now' : 'Occupied'}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <strong>Capacity:</strong> {inspectedRoom.capacity} seats
                  <CapacityAssumedBadge assumed={inspectedRoom.capacity_assumed} />
                </div>
                <div>
                  <strong>Bookable:</strong> {inspectedRoom.is_bookable ? 'Yes' : 'No (Administrative / Non-bookable)'}
                </div>
                {inspectedRoom.notes && <div><strong>Notes:</strong> {inspectedRoom.notes}</div>}
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Schedule for {formatDateReadable(date)}
              </h4>

              {scheduleLoading ? (
                <div className="text-xs text-slate-500 py-4">Loading schedule...</div>
              ) : roomDaySchedule.length === 0 ? (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                  No bookings scheduled in {inspectedRoom.name} for this entire day.
                </div>
              ) : (
                <div className="space-y-2.5 mb-4 max-h-80 overflow-y-auto pr-1">
                  {roomDaySchedule.map(b => (
                    <div
                      key={b.id}
                      className={`p-3 rounded-lg border text-xs ${
                        b.status === 'cancelled'
                          ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 font-bold">
                        <span>{formatTimeShort(b.start_at)} – {formatTimeShort(b.end_at)}</span>
                        <TestDataBadge show={b.is_test} />
                      </div>
                      <div className="font-semibold text-indigo-900 mt-0.5">{b.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        By {b.booked_by?.name} • {b.batches?.map(bt => bt.label).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canBook && inspectedRoom.is_bookable && (
                <button
                  onClick={() => onSelectRoomToBook(inspectedRoom, date, start, end)}
                  className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Book {inspectedRoom.name} ({start}–{end})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. BOOK FORM PAGE (Handles HTTP 409 Conflict + One-Click Alternative Re-Submit)
// ============================================================================
function BookRoomPage({ apiRequest, allRooms, batches, prefill, onBooked, showToast }) {
  const bookableRooms = useMemo(() => allRooms.filter(r => r.is_bookable), [allRooms]);

  const [roomId, setRoomId] = useState(prefill?.room_id || bookableRooms[5]?.id || 6); // default IET19
  const [title, setTitle] = useState('DSA Extra Problem Solving Class');
  const [purpose, setPurpose] = useState(prefill?.purpose || 'extra_class');
  const [date, setDate] = useState(prefill?.date || getTodayStr());
  const [start, setStart] = useState(prefill?.start || '10:00');
  const [end, setEnd] = useState(prefill?.end || '11:00');
  const [expectedAttendees, setExpectedAttendees] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState([2]); // default CSE Year 2 Sec A
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error422, setError422] = useState('');
  const [conflict409, setConflict409] = useState(null);

  const toggleBatch = (id) => {
    setSelectedBatchIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const autoBatchSizeSum = useMemo(() => {
    return batches
      .filter(b => selectedBatchIds.includes(b.id))
      .reduce((acc, b) => acc + b.size, 0);
  }, [batches, selectedBatchIds]);

  const submitBookingWithRoom = async (targetRoomId) => {
    setSubmitting(true);
    setError422('');
    setConflict409(null);
    try {
      const payload = {
        room_id: Number(targetRoomId),
        title,
        purpose,
        start_at: `${date}T${start}:00`,
        end_at: `${date}T${end}:00`,
        batch_ids: selectedBatchIds,
        notes: notes || null
      };
      if (expectedAttendees) {
        payload.expected_attendees = Number(expectedAttendees);
      }
      const created = await apiRequest('POST', '/bookings', payload);
      showToast(`Confirmed booking in ${created.room.name}!`, 'success');
      onBooked();
    } catch (err) {
      if (err.status === 409 && err.detail) {
        setConflict409(err.detail);
      } else {
        setError422(err.message || 'Could not create booking');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitBookingWithRoom(roomId);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Book a Classroom / Lecture Hall</h2>
            <p className="text-xs text-slate-500">
              All booking rules and capacity constraints are verified by the backend API.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              // Pre-fill IET19 at today 10:00-11:00 to immediately demonstrate the 409 Conflict UX
              setRoomId(6);
              setDate(getTodayStr());
              setStart('10:00');
              setEnd('11:00');
              showToast('Pre-filled IET19 at 10:00–11:00. Click "Confirm Booking" to test the 409 Clash & Alternatives UX!', 'info');
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold"
          >
            Test 409 Clash Scenario (IET19 @ 10:00)
          </button>
        </div>

        {/* HTTP 422 / Validation Alert */}
        {error422 && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5">
            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <strong className="block">Booking Rejected by Server:</strong>
              {error422}
            </div>
          </div>
        )}

        {/* HTTP 409 Conflict Alert with One-Click Alternatives */}
        {conflict409 && (
          <div className="mb-6 p-5 rounded-2xl bg-red-50 border-2 border-red-300 text-red-950 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-red-900">
                  HTTP 409 Conflict: {conflict409.message}
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  The requested room is already occupied during this time window. Review the clashing booking below or click any verified alternative room to book immediately in one click.
                </p>
              </div>
            </div>

            {/* Clashing Booking Details */}
            <div className="bg-white/90 rounded-xl p-3.5 border border-red-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-red-700 mb-2">
                Clashing Booking(s)
              </div>
              {conflict409.conflicts?.map(c => (
                <div key={c.id} className="text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-slate-900">{c.title}</strong> ({c.room?.name}) • {formatTimeShort(c.start_at)}–{formatTimeShort(c.end_at)}
                    <div className="text-slate-500">
                      Booked by {c.booked_by?.name} • Batches: {c.batches?.map(b => b.label).join(', ')}
                    </div>
                  </div>
                  <TestDataBadge show={c.is_test} />
                </div>
              ))}
            </div>

            {/* One-Click Alternative Rooms */}
            <div>
              <div className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                One-Click Available Alternatives (Matches Capacity & Purpose):
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {conflict409.alternatives?.map(alt => (
                  <button
                    key={alt.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setRoomId(alt.id);
                      submitBookingWithRoom(alt.id);
                    }}
                    className="p-3 rounded-xl bg-white hover:bg-emerald-50 border-2 border-emerald-400 text-left transition shadow-sm group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-800">
                        {alt.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Book Now →
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">
                      {alt.building} • Floor {alt.floor}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Cap: <strong>{alt.capacity}</strong> {alt.capacity_assumed && '(capacity assumed)'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Room</label>
              <select
                value={roomId}
                onChange={e => setRoomId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {bookableRooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.building} Flr {r.floor}) — Cap {r.capacity}{r.capacity_assumed ? ' (assumed)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose</label>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {PURPOSES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Event Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Operating Systems Remedial Lecture"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time (IST)</label>
              <input
                type="time"
                required
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Time (IST)</label>
              <input
                type="time"
                required
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Batches Multi-select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Participating Batches (Auto-calculates attendees if blank)
            </label>
            <div className="flex flex-wrap gap-2">
              {batches.map(b => {
                const active = selectedBatchIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBatch(b.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      active
                        ? 'bg-indigo-700 text-white border-indigo-700'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {b.label} ({b.size})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Attendees (Optional)
              </label>
              <input
                type="number"
                value={expectedAttendees}
                onChange={e => setExpectedAttendees(e.target.value)}
                placeholder={`Default from batches: ${autoBatchSizeSum || 60}`}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g., Bring laptop for coding test"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow transition"
            >
              {submitting ? 'Submitting Booking Request...' : 'Confirm Classroom Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 5. MY BOOKINGS PAGE (Cancel with reason, Reschedule with 409 handling, Audit History)
// ============================================================================
function MyBookingsPage({ apiRequest, allRooms, showToast }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedStart, setReschedStart] = useState('');
  const [reschedEnd, setReschedEnd] = useState('');
  const [reschedRoomId, setReschedRoomId] = useState('');
  const [reschedReason, setReschedReason] = useState('');
  const [reschedConflict409, setReschedConflict409] = useState(null);

  // History / Audit panel state
  const [historyBooking, setHistoryBooking] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('GET', '/bookings?mine=true&include_cancelled=true');
      setBookings(data || []);
    } catch (e) {
      showToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, showToast]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelTarget) return;
    try {
      await apiRequest('POST', `/bookings/${cancelTarget.id}/cancel`, {
        reason: cancelReason || 'Faculty schedule adjustment'
      });
      showToast('Booking cancelled and cancellation notice auto-published!', 'info');
      setCancelTarget(null);
      setCancelReason('');
      loadBookings();
    } catch (err) {
      showToast(err.message || 'Cancel failed', 'error');
    }
  };

  const openReschedule = (b) => {
    setRescheduleTarget(b);
    setReschedDate(b.start_at.split('T')[0]);
    setReschedStart(formatTimeShort(b.start_at));
    setReschedEnd(formatTimeShort(b.end_at));
    setReschedRoomId(b.room?.id || b.room_id);
    setReschedReason('');
    setReschedConflict409(null);
  };

  const submitReschedule = async (overrideRoomId) => {
    if (!rescheduleTarget) return;
    setReschedConflict409(null);
    try {
      await apiRequest('PATCH', `/bookings/${rescheduleTarget.id}`, {
        room_id: Number(overrideRoomId || reschedRoomId),
        start_at: `${reschedDate}T${reschedStart}:00`,
        end_at: `${reschedDate}T${reschedEnd}:00`,
        reason: reschedReason || 'Rescheduled by faculty'
      });
      showToast('Booking rescheduled and notice published!', 'success');
      setRescheduleTarget(null);
      loadBookings();
    } catch (err) {
      if (err.status === 409 && err.detail) {
        setReschedConflict409(err.detail);
      } else {
        showToast(err.message || 'Reschedule failed', 'error');
      }
    }
  };

  const openAuditHistory = async (b) => {
    setHistoryBooking(b);
    try {
      const logs = await apiRequest('GET', `/audit?entity=booking&entity_id=${b.id}`);
      setAuditLogs(logs || []);
    } catch {
      setAuditLogs([]);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">My Classroom Bookings</h2>
            <p className="text-xs text-slate-500">
              Cancelling or rescheduling automatically publishes an announcement to the affected student batches.
            </p>
          </div>
          <button
            onClick={loadBookings}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">Loading your bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">No bookings found under your account.</div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => {
              const isCancelled = b.status === 'cancelled';
              return (
                <div
                  key={b.id}
                  className={`bg-white rounded-xl p-4 shadow-sm border transition ${
                    isCancelled ? 'border-red-200 bg-red-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-base ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {b.title}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-indigo-100 text-indigo-800">
                          {b.room?.name} ({b.room?.building})
                        </span>
                        {isCancelled ? (
                          <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-800 border border-red-300">
                            Cancelled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-100 text-emerald-800">
                            Confirmed
                          </span>
                        )}
                        <TestDataBadge show={b.is_test} />
                      </div>

                      <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-3">
                        <span>📅 {formatDateReadable(b.start_at)}</span>
                        <span>⏰ {formatTimeShort(b.start_at)} – {formatTimeShort(b.end_at)}</span>
                        <span className="capitalize">🎯 {b.purpose.replace('_', ' ')}</span>
                        <span>👥 {b.expected_attendees} attendees</span>
                      </div>

                      <div className="text-xs text-slate-500 mt-1">
                        Batches: <strong>{b.batches?.map(bt => bt.label).join(', ') || 'None'}</strong>
                      </div>
                      {b.notes && <div className="text-xs text-slate-500 italic mt-1">{b.notes}</div>}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCancelled && (
                        <>
                          <button
                            onClick={() => openReschedule(b)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => { setCancelTarget(b); setCancelReason(''); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openAuditHistory(b)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" /> History
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Audit History Drawer + Active Modals */}
      <div className="space-y-4">
        {/* Cancel Modal */}
        {cancelTarget && (
          <div className="bg-white rounded-2xl p-5 shadow-md border-2 border-red-300">
            <h3 className="font-bold text-sm text-red-900 mb-1">
              Cancel Booking: {cancelTarget.title} ({cancelTarget.room?.name})
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              Please provide a reason. A cancellation announcement will be automatically published to the student feed.
            </p>
            <form onSubmit={handleConfirmCancel} className="space-y-3">
              <input
                type="text"
                required
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason (e.g., Faculty meeting / Lab maintenance)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg"
                >
                  Confirm Cancellation
                </button>
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Reschedule Modal */}
        {rescheduleTarget && (
          <div className="bg-white rounded-2xl p-5 shadow-md border-2 border-amber-300 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                Reschedule: {rescheduleTarget.title}
              </h3>
              <button onClick={() => setRescheduleTarget(null)} className="text-xs text-slate-400">✕</button>
            </div>

            {reschedConflict409 && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-xs space-y-2">
                <div className="font-bold text-red-800">{reschedConflict409.message}</div>
                <div className="text-slate-700 font-medium">Pick an alternative room in 1 click:</div>
                <div className="flex flex-wrap gap-1.5">
                  {reschedConflict409.alternatives?.map(alt => (
                    <button
                      key={alt.id}
                      type="button"
                      onClick={() => submitReschedule(alt.id)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold"
                    >
                      {alt.name} (Cap {alt.capacity})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Room</label>
                <select
                  value={reschedRoomId}
                  onChange={e => setReschedRoomId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {allRooms.filter(r => r.is_bookable).map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.building})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={reschedDate}
                  onChange={e => setReschedDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start</label>
                  <input
                    type="time"
                    value={reschedStart}
                    onChange={e => setReschedStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End</label>
                  <input
                    type="time"
                    value={reschedEnd}
                    onChange={e => setReschedEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Reschedule</label>
                <input
                  type="text"
                  value={reschedReason}
                  onChange={e => setReschedReason(e.target.value)}
                  placeholder="e.g., Shifted to afternoon slot"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={() => submitReschedule()}
                className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-lg"
              >
                Save & Publish Reschedule
              </button>
            </div>
          </div>
        )}

        {/* Audit History Panel (GET /audit) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-indigo-700" />
            Booking Audit History (/audit)
          </h3>
          {!historyBooking ? (
            <p className="text-xs text-slate-500">
              Click "History" on any booking to inspect who created, rescheduled, or cancelled it with old and new values.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-indigo-900 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100">
                Inspecting: {historyBooking.title} (#{historyBooking.id})
              </div>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">No audit records found.</p>
              ) : (
                <div className="space-y-2.5">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                          {log.action}
                        </span>
                        <TestDataBadge show={log.is_test} />
                      </div>
                      <div className="text-slate-700 font-medium">By: {log.actor}</div>
                      <div className="text-[11px] text-slate-400">{log.timestamp.replace('T', ' ')}</div>
                      {log.old_value && (
                        <div className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded">
                          Old: {JSON.stringify(log.old_value)}
                        </div>
                      )}
                      {log.new_value && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50 p-1.5 rounded">
                          New: {JSON.stringify(log.new_value)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. STUDENT SCHEDULE PAGE (Weekly View, Cancelled Struck-Through, Report Problem)
// ============================================================================
function StudentSchedulePage({ apiRequest, currentUser, batches, showToast }) {
  const [selectedBatchId, setSelectedBatchId] = useState(currentUser?.batch_id || 2);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Report a problem modal state
  const [reportTarget, setReportTarget] = useState(null);
  const [reportKind, setReportKind] = useState('comment');
  const [reportText, setReportText] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const path = currentUser.role === 'student' && selectedBatchId === currentUser.batch_id
        ? '/me/schedule'
        : `/batches/${selectedBatchId}/schedule?include_cancelled=true`;
      const data = await apiRequest('GET', path);
      setScheduleItems(data || []);
    } catch (e) {
      showToast('Failed to load batch schedule', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, currentUser, selectedBatchId, showToast]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    setSubmittingReport(true);
    try {
      await apiRequest('POST', '/reports', {
        kind: reportKind,
        text: reportText,
        booking_id: reportTarget?.id
      });
      showToast('Report submitted to Faculty/Admin inbox! (Bookings remain unchanged)', 'success');
      setReportTarget(null);
      setReportText('');
    } catch (err) {
      showToast(err.message || 'Could not submit report', 'error');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Weekly Class & Exam Schedule
          </h2>
          <p className="text-xs text-slate-500">
            Cancelled classes are shown struck-through with a red Cancelled badge so students are never caught off-guard.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Batch:</label>
          <select
            value={selectedBatchId}
            onChange={e => setSelectedBatchId(Number(e.target.value))}
            className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
          >
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Report a problem modal */}
      {reportTarget && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-md max-w-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-amber-950 flex items-center gap-2">
              <MessageSquareWarning className="w-4 h-4 text-amber-700" />
              Report a Problem on: {reportTarget.title} ({reportTarget.room?.name})
            </h3>
            <button onClick={() => setReportTarget(null)} className="text-xs text-slate-500">✕</button>
          </div>
          <form onSubmit={handleReportSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Category</label>
              <select
                value={reportKind}
                onChange={e => setReportKind(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="comment">General Comment / Equipment Issue</option>
                <option value="conflict">Timetable Clash / Room Conflict</option>
                <option value="outdated">Outdated Schedule Information</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                required
                value={reportText}
                onChange={e => setReportText(e.target.value)}
                placeholder="Describe the issue for the department admin..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submittingReport}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg"
              >
                {submittingReport ? 'Sending...' : 'Submit Report'}
              </button>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="px-3 py-2 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">Loading schedule...</div>
      ) : scheduleItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">
          No classes or bookings scheduled for this batch yet.
        </div>
      ) : (
        <div className="space-y-3">
          {scheduleItems.map(item => {
            const isCancelled = item.status === 'cancelled';
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl p-4 shadow-sm border flex flex-wrap items-center justify-between gap-4 ${
                  isCancelled ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-900 text-white">
                      {formatDateReadable(item.start_at)} • {formatTimeShort(item.start_at)}–{formatTimeShort(item.end_at)}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-900">
                      Room {item.room?.name} ({item.room?.building}, Floor {item.room?.floor})
                    </span>
                    {isCancelled && (
                      <span className="px-2.5 py-0.5 text-xs font-extrabold uppercase rounded bg-red-600 text-white shadow-sm">
                        Cancelled
                      </span>
                    )}
                    <TestDataBadge show={item.is_test} />
                  </div>

                  <div className={`text-base font-bold ${isCancelled ? 'line-through text-red-800/70' : 'text-slate-900'}`}>
                    {item.title}
                  </div>

                  <div className="text-xs text-slate-600">
                    Faculty: <strong>{item.booked_by?.name}</strong> • Purpose: <span className="capitalize">{item.purpose.replace('_', ' ')}</span>
                  </div>
                  {item.notes && (
                    <div className="text-xs text-slate-500 italic">Note: {item.notes}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { setReportTarget(item); setReportText(''); }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 transition flex items-center gap-1.5"
                >
                  <MessageSquareWarning className="w-3.5 h-3.5" />
                  Report a problem
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 7. ANNOUNCEMENTS FEED PAGE (Badges per kind + Faculty Exam/General Notice Form)
// ============================================================================
function AnnouncementsPage({ apiRequest, currentUser, showToast }) {
  const [announcements, setAnnouncements] = useState([]);
  const [filterKind, setFilterKind] = useState('');
  const [loading, setLoading] = useState(true);

  // Post Notice form (Faculty/Admin)
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('exam_notice');
  const [posting, setPosting] = useState(false);

  const canPost = currentUser.role === 'faculty' || currentUser.role === 'admin';

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterKind ? `?kind=${filterKind}` : '';
      const data = await apiRequest('GET', `/announcements${q}`);
      setAnnouncements(data || []);
    } catch {
      showToast('Failed to load announcements', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, filterKind, showToast]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      await apiRequest('POST', '/announcements', { title, body, kind });
      setTitle('');
      setBody('');
      showToast('Notice published to campus feed!', 'success');
      loadAnnouncements();
    } catch (err) {
      showToast(err.message || 'Could not post notice', 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Campus Announcements & Notices</h2>
            <p className="text-xs text-slate-500">
              Live feed of class cancellations, reschedules, minor exam notices, and general alerts.
            </p>
          </div>
          <select
            value={filterKind}
            onChange={e => setFilterKind(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Notice Types</option>
            <option value="cancellation">Cancellations</option>
            <option value="reschedule">Reschedules</option>
            <option value="exam_notice">Exam Notices</option>
            <option value="general">General Notices</option>
          </select>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">Loading announcements...</div>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => {
              const badge = ANNOUNCEMENT_KINDS[a.kind] || ANNOUNCEMENT_KINDS.general;
              return (
                <div key={a.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <TestDataBadge show={a.is_test} />
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatDateReadable(a.created_at)} • {formatTimeShort(a.created_at)}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{a.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{a.body}</p>
                  <div className="text-[11px] text-slate-500 pt-1">
                    Posted by <strong>{a.author}</strong>
                    {a.batches?.length > 0 && ` • Affected: ${a.batches.join(', ')}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Faculty / Admin Notice Publisher */}
      {canPost && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-bold text-sm text-slate-900 mb-1">Post Exam or General Notice</h3>
          <p className="text-xs text-slate-500 mb-4">
            Broadcast an official exam notice or general announcement to students.
          </p>
          <form onSubmit={handlePost} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Type</label>
              <select
                value={kind}
                onChange={e => setKind(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="exam_notice">Exam Notice</option>
                <option value="general">General Announcement</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Mid-Sem Minor Exam Seating Plan"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message Body</label>
              <textarea
                rows={4}
                required
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Enter full notice details, room numbers, and instructions..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={posting}
              className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow"
            >
              {posting ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 8. ADMIN DASHBOARD PAGE (Reports Inbox, Edit Room Capacity/Uses, Create Faculty)
// ============================================================================
function AdminDashboardPage({ apiRequest, allRooms, onRoomsUpdated, showToast }) {
  const [reports, setReports] = useState([]);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editCapacity, setEditCapacity] = useState(75);
  const [editUses, setEditUses] = useState([]);
  const [editBookable, setEditBookable] = useState(true);
  const [editNotes, setEditNotes] = useState('');

  // Create Faculty / User state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('demo1234');
  const [newRole, setNewRole] = useState('faculty');

  const loadReports = useCallback(async () => {
    try {
      const data = await apiRequest('GET', '/reports');
      setReports(data || []);
    } catch {
      // ignore
    }
  }, [apiRequest]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleResolveReport = async (repId) => {
    try {
      await apiRequest('PATCH', `/reports/${repId}`, { status: 'resolved' });
      showToast('Report marked as resolved!', 'success');
      loadReports();
    } catch (e) {
      showToast('Failed to resolve report', 'error');
    }
  };

  const startEditRoom = (room) => {
    setEditingRoom(room);
    setEditCapacity(room.capacity);
    setEditUses(room.allowed_uses || []);
    setEditBookable(room.is_bookable);
    setEditNotes(room.notes || '');
  };

  const toggleAllowedUse = (u) => {
    setEditUses(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    if (!editingRoom) return;
    try {
      await apiRequest('PATCH', `/rooms/${editingRoom.id}`, {
        capacity: Number(editCapacity),
        allowed_uses: editUses,
        is_bookable: editBookable,
        notes: editNotes
      });
      showToast(`Updated room ${editingRoom.name}!`, 'success');
      setEditingRoom(null);
      onRoomsUpdated();
    } catch (err) {
      showToast(err.message || 'Could not update room', 'error');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const created = await apiRequest('POST', '/admin/users', {
        email: newEmail,
        name: newName,
        password: newPassword,
        role: newRole
      });
      showToast(`Created ${created.role} account for ${created.name}!`, 'success');
      setNewEmail('');
      setNewName('');
    } catch (err) {
      showToast(err.message || 'Failed to create user', 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Row: Reports Inbox & Create Faculty Form */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Reports Inbox */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Student & Faculty Reports Inbox (/reports)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Review reported timetable clashes, room equipment issues, or outdated notices.
          </p>
          <div className="space-y-3">
            {reports.map(r => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                      {r.kind}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      r.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {r.status}
                    </span>
                    <TestDataBadge show={r.is_test} />
                  </div>
                  <div className="text-xs font-bold text-slate-900">{r.text}</div>
                  <div className="text-[11px] text-slate-500">
                    Re: {r.booking_title} • By {r.created_by?.name}
                  </div>
                </div>
                {r.status === 'open' && (
                  <button
                    onClick={() => handleResolveReport(r.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create Faculty / Admin Account */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-1">Create Faculty / Staff Account</h3>
          <p className="text-xs text-slate-500 mb-4">
            Provision official accounts via POST /admin/users.
          </p>
          <form onSubmit={handleCreateUser} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Dr. Anjali Mishra"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="anjali.cs@ddugu.ac.in"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temp Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow"
            >
              Create Account
            </button>
          </form>
        </div>
      </div>

      {/* Edit Room Modal / Form */}
      {editingRoom && (
        <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm text-indigo-950">
              Edit Room Configuration: {editingRoom.name} ({editingRoom.building})
            </h4>
            <button onClick={() => setEditingRoom(null)} className="text-xs text-slate-500">✕</button>
          </div>
          <form onSubmit={handleSaveRoom} className="grid sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
              <input
                type="number"
                value={editCapacity}
                onChange={e => setEditCapacity(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Allowed Uses</label>
              <div className="flex flex-wrap gap-1.5">
                {PURPOSES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => toggleAllowedUse(p.value)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                      editUses.includes(p.value)
                        ? 'bg-indigo-700 text-white border-indigo-700'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg"
              >
                Save PATCH
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manage Rooms Table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
        <h3 className="text-base font-bold text-slate-900 mb-3">
          Manage Campus Rooms & Allowed Uses (PATCH /rooms/&#123;id&#125;)
        </h3>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 uppercase">
              <th className="py-2.5 px-3">Room</th>
              <th className="py-2.5 px-3">Building / Floor</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Capacity</th>
              <th className="py-2.5 px-3">Allowed Uses</th>
              <th className="py-2.5 px-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allRooms.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-bold text-slate-900">{r.name}</td>
                <td className="py-2.5 px-3">{r.building} (Floor {r.floor})</td>
                <td className="py-2.5 px-3 capitalize">{r.type.replace('_', ' ')}</td>
                <td className="py-2.5 px-3">
                  <strong>{r.capacity}</strong>
                  <CapacityAssumedBadge assumed={r.capacity_assumed} />
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex flex-wrap gap-1">
                    {r.allowed_uses?.map(u => (
                      <span key={u} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                        {u}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <button
                    onClick={() => startEditRoom(r)}
                    className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold inline-flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}