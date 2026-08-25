import React from 'react';
import { TabType } from '../types';

interface ReportPreviewViewProps {
  onBack: () => void;
  onNavigate: (tab: TabType) => void;
}

export const ReportPreviewView: React.FC<ReportPreviewViewProps> = ({
  onBack,
}) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-bold text-[#002869] hover:underline cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Reports List
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#002869] text-white rounded-md text-[13px] font-bold hover:bg-[#002869]/90 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print / Save PDF
          </button>
          <button
            onClick={() => alert('Editing report draft mode activated.')}
            className="flex items-center gap-1.5 px-4 py-2 border border-[#002869] text-[#002869] rounded-md text-[13px] font-bold hover:bg-[#f4f3fb] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            Edit Report
          </button>
        </div>
      </div>

      {/* Official TQI Activity Report Document (Matching Image 23 & HTML 23) */}
      <div className="bg-white rounded-md border border-[#c4c6d3]/80 p-6 md:p-10 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Title & Organization Header */}
        <div className="text-center pb-4">
          <div className="text-[12px] font-extrabold uppercase tracking-widest text-[#002869] mb-1">
            TALENT QUEST FOR INDIA
          </div>
          <h1 className="text-[22px] md:text-[25px] font-bold text-[#002869] leading-tight">
            Awareness and Skill Development Program
          </h1>
          <p className="text-[16px] font-bold text-[#fb7800] mt-1">
            Academic Year (2023 - 2024) Activity Report
          </p>
        </div>

        {/* Blue Separator Line */}
        <div className="h-1.5 bg-[#002869] rounded-full w-full"></div>

        {/* Metadata Details Table / Grid */}
        <div className="bg-[#f4f3fb] border border-[#c4c6d3]/60 rounded-md p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-[13px]">
          <div>
            <span className="text-[11px] font-bold text-[#747783] uppercase block">District</span>
            <span className="font-bold text-[#1a1b21]">Dharmapuri</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#747783] uppercase block">Panchayat</span>
            <span className="font-bold text-[#002869]">Vedakkattamaduvu</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#747783] uppercase block">Village / Center</span>
            <span className="font-bold text-[#1a1b21]">Ammapettai</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#747783] uppercase block">Standard (Std)</span>
            <span className="font-bold text-[#1a1b21]">6th - 9th Std (28 Students)</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#747783] uppercase block">Module Covered</span>
            <span className="font-bold text-[#fb7800]">Spoken English &amp; Digital Skills</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#747783] uppercase block">Duration Dates</span>
            <span className="font-bold text-[#1a1b21]">Oct 15 - Oct 25, 2023</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#747783] uppercase block">Lead Volunteer</span>
            <span className="font-bold text-[#1a1b21]">Bala Murugan (Coordinator)</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#747783] uppercase block">Cluster Admin</span>
            <span className="font-bold text-[#1a1b21]">Priya Natarajan</span>
          </div>
        </div>

        {/* Section 1: Introduction */}
        <div className="space-y-2">
          <h2 className="text-[16px] font-bold text-[#002869] border-b border-[#c4c6d3]/50 pb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#002869]"></span>
            1. Introduction &amp; Program Objectives
          </h2>
          <p className="text-[14px] text-[#1a1b21] leading-relaxed text-justify">
            The Awareness and Skill Development Program was conducted at Ammapettai Village,
            Vedakkattamaduvu Panchayat, over a ten-day intensive learning sprint. The primary goal of
            the intervention is to bridge experiential learning gaps among rural government middle
            and high school students, equipping them with foundational digital literacy, fluent
            English conversational habits, and collaborative problem-solving mindset.
          </p>
        </div>

        {/* Section 2: Skill Enhancement Activities */}
        <div className="space-y-3">
          <h2 className="text-[16px] font-bold text-[#002869] border-b border-[#c4c6d3]/50 pb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#002869]"></span>
            2. Skill Enhancement Activities Conducted
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
            <div className="bg-[#f8fafc] p-3.5 rounded-md border border-[#c4c6d3]/50">
              <h3 className="font-bold text-[#002869] mb-1">
                A. Phonics &amp; Conversational Drills
              </h3>
              <p className="text-[#434652] leading-snug">
                Daily 30-minute interactive speaking circles focusing on self-introduction, sentence
                framing, basic vocabulary cards, and role-playing daily life situations.
              </p>
            </div>

            <div className="bg-[#f8fafc] p-3.5 rounded-md border border-[#c4c6d3]/50">
              <h3 className="font-bold text-[#002869] mb-1">
                B. Basic Computer &amp; Typing Literacy
              </h3>
              <p className="text-[#434652] leading-snug">
                Students practiced laptop touch typing using open-source educational software,
                learned directory navigation, and created simple document write-ups.
              </p>
            </div>

            <div className="bg-[#f8fafc] p-3.5 rounded-md border border-[#c4c6d3]/50">
              <h3 className="font-bold text-[#002869] mb-1">
                C. Practical Math Logic &amp; Puzzles
              </h3>
              <p className="text-[#434652] leading-snug">
                Hands-on fraction blocks, geometric shape identification with origami sheets, and
                speed mental math puzzles to boost numerical confidence.
              </p>
            </div>

            <div className="bg-[#f8fafc] p-3.5 rounded-md border border-[#c4c6d3]/50">
              <h3 className="font-bold text-[#002869] mb-1">
                D. Team Storytelling &amp; Peer Reviews
              </h3>
              <p className="text-[#434652] leading-snug">
                Students collaborated in groups of 4 to craft illustrated moral storybooks, presenting
                their stories aloud to the entire classroom.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Student Feedback & Observations */}
        <div className="space-y-3">
          <h2 className="text-[16px] font-bold text-[#002869] border-b border-[#c4c6d3]/50 pb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#002869]"></span>
            3. Student Progress &amp; Qualitative Observations
          </h2>
          <div className="overflow-x-auto border border-[#c4c6d3]/60 rounded-md">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead className="bg-[#f4f3fb] border-b border-[#c4c6d3] text-[11px] font-bold text-[#434652] uppercase">
                <tr>
                  <th className="p-3 pl-4">Assessment Metric</th>
                  <th className="p-3">Baseline (Day 1)</th>
                  <th className="p-3">Endline (Day 10)</th>
                  <th className="p-3 pr-4">Remark / Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c6d3]/40">
                <tr>
                  <td className="p-3 pl-4 font-bold text-[#1a1b21]">English Conversation</td>
                  <td className="p-3 text-[#ba1a1a]">Hesitant, 22% fluency</td>
                  <td className="p-3 font-bold text-[#137333]">78% Fluency &amp; Eager</td>
                  <td className="p-3 pr-4 text-[#434652]">High willingness to speak in public</td>
                </tr>
                <tr>
                  <td className="p-3 pl-4 font-bold text-[#1a1b21]">Computer Operation</td>
                  <td className="p-3 text-[#ba1a1a]">14% could power/type</td>
                  <td className="p-3 font-bold text-[#137333]">92% Independent typing</td>
                  <td className="p-3 pr-4 text-[#434652]">Understands keyboard &amp; trackpad</td>
                </tr>
                <tr>
                  <td className="p-3 pl-4 font-bold text-[#1a1b21]">Daily Attendance</td>
                  <td className="p-3 text-[#434652]">24 students present</td>
                  <td className="p-3 font-bold text-[#137333]">28 students (100%)</td>
                  <td className="p-3 pr-4 text-[#434652]">Zero dropouts during sprint</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Session Photographs */}
        <div className="space-y-3">
          <h2 className="text-[16px] font-bold text-[#002869] border-b border-[#c4c6d3]/50 pb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#002869]"></span>
            4. Session Photographs &amp; Field Documentation
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md overflow-hidden border border-[#c4c6d3]/60 bg-[#f4f3fb]">
              <img
                src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=400"
                alt="Classroom"
                className="w-full h-32 object-cover"
                referrerPolicy="no-referrer"
              />
              <p className="p-2 text-[11px] font-medium text-[#434652] leading-tight text-center">
                Interactive classroom learning
              </p>
            </div>
            <div className="rounded-md overflow-hidden border border-[#c4c6d3]/60 bg-[#f4f3fb]">
              <img
                src="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=400"
                alt="Spoken English"
                className="w-full h-32 object-cover"
                referrerPolicy="no-referrer"
              />
              <p className="p-2 text-[11px] font-medium text-[#434652] leading-tight text-center">
                Group phonics speaking drills
              </p>
            </div>
            <div className="rounded-md overflow-hidden border border-[#c4c6d3]/60 bg-[#f4f3fb]">
              <img
                src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=400"
                alt="Math Puzzles"
                className="w-full h-32 object-cover"
                referrerPolicy="no-referrer"
              />
              <p className="p-2 text-[11px] font-medium text-[#434652] leading-tight text-center">
                Hands-on geometry worksheets
              </p>
            </div>
            <div className="rounded-md overflow-hidden border border-[#c4c6d3]/60 bg-[#f4f3fb]">
              <img
                src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=400"
                alt="Reading Circle"
                className="w-full h-32 object-cover"
                referrerPolicy="no-referrer"
              />
              <p className="p-2 text-[11px] font-medium text-[#434652] leading-tight text-center">
                Storybook reading &amp; peer review
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Verification & Signatures */}
        <div className="pt-6 border-t-2 border-[#002869] grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-[13px]">
          <div>
            <div className="h-14 flex items-end justify-center font-serif text-[#002869] italic text-[17px]">
              Bala Murugan
            </div>
            <div className="border-t border-[#434652] pt-1 font-bold text-[#1a1b21]">
              Lead Volunteer Coordinator
            </div>
            <span className="text-[11px] text-[#747783]">Ammapettai Center</span>
          </div>

          <div>
            <div className="h-14 flex items-end justify-center font-serif text-[#002869] italic text-[17px]">
              Priya Natarajan
            </div>
            <div className="border-t border-[#434652] pt-1 font-bold text-[#1a1b21]">
              Cluster Administrator
            </div>
            <span className="text-[11px] text-[#747783]">Dharmapuri Cluster</span>
          </div>

          <div>
            <div className="h-14 flex items-end justify-center font-serif text-[#002869] italic text-[17px]">
              R. Soundararajan
            </div>
            <div className="border-t border-[#434652] pt-1 font-bold text-[#1a1b21]">
              Headmaster / Panchayat Representative
            </div>
            <span className="text-[11px] text-[#747783]">Govt Middle School, Ammapettai</span>
          </div>
        </div>
      </div>
    </div>
  );
};

