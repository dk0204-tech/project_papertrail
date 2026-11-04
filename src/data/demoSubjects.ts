import { Subject, SemesterNumber } from '../types'

/**
 * ILLUSTRATIVE DEMO DATA — NOT VERIFIED OFFICIAL EXAM STATISTICS.
 *
 * Subject names, codes, departments and credit structures below are fictional
 * examples used only to demonstrate the platform. They are not a claim about
 * the official current MIT Manipal curriculum.
 */

export const DEMO_DISCLAIMER =
  'ILLUSTRATIVE DEMO DATA — NOT VERIFIED OFFICIAL EXAM STATISTICS'

export const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Mathematics & Sciences',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
] as const

export const PROGRAMMES = ['B.Tech Computer Science', 'B.Tech Electronics', 'B.Tech Mechanical'] as const

const s = (
  id: string,
  name: string,
  code: string,
  department: string,
  programme: string,
  semester: SemesterNumber,
  courseType: Subject['courseType'],
  credits: number,
): Subject => ({
  id, name, code, department, programme, semester, courseType, credits, scheme: 'Illustrative 2024 scheme',
})

export const DEMO_SUBJECTS: Subject[] = [
  // ── Semester 1 ────────────────────────────────────────────────────────────
  s('sub-pps', 'Programming and Problem Solving', 'PCL1001', 'Computer Science & Engineering', 'B.Tech Computer Science', 1, 'Core', 4),
  s('sub-math1', 'Engineering Mathematics I', 'MNS1001', 'Mathematics & Sciences', 'B.Tech Computer Science', 1, 'Core', 4),
  s('sub-eee', 'Basic Electrical Engineering', 'EEE1001', 'Electrical & Electronics Engineering', 'B.Tech Electronics', 1, 'Core', 3),

  // ── Semester 2 ────────────────────────────────────────────────────────────
  s('sub-math2', 'Engineering Mathematics II', 'MNS1002', 'Mathematics & Sciences', 'B.Tech Computer Science', 2, 'Core', 4),
  s('sub-see', 'Basic Electronics Engineering', 'ECE1002', 'Electronics & Communication Engineering', 'B.Tech Electronics', 2, 'Core', 3),
  s('sub-egd', 'Engineering Graphics & Design', 'MEC1002', 'Mechanical Engineering', 'B.Tech Mechanical', 2, 'Core', 2),

  // ── Semester 3 ────────────────────────────────────────────────────────────
  s('sub-dsa', 'Data Structures and Algorithms', 'CSE2001', 'Computer Science & Engineering', 'B.Tech Computer Science', 3, 'Core', 4),
  s('sub-dm', 'Discrete Mathematics', 'MNS2001', 'Mathematics & Sciences', 'B.Tech Computer Science', 3, 'Core', 3),
  s('sub-dss', 'Digital Systems', 'ECE2001', 'Electronics & Communication Engineering', 'B.Tech Electronics', 3, 'Core', 4),

  // ── Semester 4 ────────────────────────────────────────────────────────────
  s('sub-cn', 'Computer Networks', 'CSE2002', 'Computer Science & Engineering', 'B.Tech Computer Science', 4, 'Core', 4),
  s('sub-os', 'Operating Systems', 'CSE2003', 'Computer Science & Engineering', 'B.Tech Computer Science', 4, 'Core', 4),
  s('sub-dbs', 'Database Systems', 'CSE2004', 'Computer Science & Engineering', 'B.Tech Computer Science', 4, 'Core', 4),

  // ── Semester 5 ────────────────────────────────────────────────────────────
  s('sub-ml', 'Machine Learning', 'CSE3001', 'Computer Science & Engineering', 'B.Tech Computer Science', 5, 'Core', 4),
  s('sub-coa', 'Computer Architecture & Organization', 'CSE3002', 'Computer Science & Engineering', 'B.Tech Computer Science', 5, 'Core', 4),
  s('sub-toc', 'Theory of Computation', 'CSE3003', 'Computer Science & Engineering', 'B.Tech Computer Science', 5, 'Core', 3),

  // ── Semester 6 ────────────────────────────────────────────────────────────
  s('sub-ai', 'Artificial Intelligence', 'CSE3004', 'Computer Science & Engineering', 'B.Tech Computer Science', 6, 'Core', 4),
  s('sub-cns', 'Cryptography & Network Security', 'CSE3005', 'Computer Science & Engineering', 'B.Tech Computer Science', 6, 'Elective', 3),
  s('sub-cloud', 'Cloud Computing', 'CSE3006', 'Computer Science & Engineering', 'B.Tech Computer Science', 6, 'Elective', 3),

  // ── Semester 7 ────────────────────────────────────────────────────────────
  s('sub-dl', 'Deep Learning', 'CSE4001', 'Computer Science & Engineering', 'B.Tech Computer Science', 7, 'Elective', 4),
  s('sub-bigdata', 'Big Data Analytics', 'CSE4002', 'Computer Science & Engineering', 'B.Tech Computer Science', 7, 'Elective', 3),
  s('sub-iot', 'Internet of Things', 'ECE4001', 'Electronics & Communication Engineering', 'B.Tech Electronics', 7, 'Elective', 3),

  // ── Semester 8 ────────────────────────────────────────────────────────────
  s('sub-nlp', 'Natural Language Processing', 'CSE4003', 'Computer Science & Engineering', 'B.Tech Computer Science', 8, 'Elective', 3),
  s('sub-distsys', 'Distributed Systems', 'CSE4004', 'Computer Science & Engineering', 'B.Tech Computer Science', 8, 'Elective', 3),
  s('sub-genai', 'Generative AI', 'CSE4005', 'Computer Science & Engineering', 'B.Tech Computer Science', 8, 'Elective', 3),
]

export const SEMESTERS: SemesterNumber[] = [1, 2, 3, 4, 5, 6, 7, 8]
