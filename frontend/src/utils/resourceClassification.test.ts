// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { classifyResource } from './resourceClassification';

describe('classifyResource presentation helper', () => {
  describe('Reference resources (purpose = reference)', () => {
    it('classifies titles containing course as Course Reference with accent tone', () => {
      expect(classifyResource('Crash Course Notes', 'reference')).toEqual({
        label: 'Course Reference',
        tone: 'accent',
      });
      expect(classifyResource('ONLINE COURSES', 'reference')).toEqual({
        label: 'Course Reference',
        tone: 'accent',
      });
    });

    it('classifies titles containing project as Project Reference with accent tone', () => {
      expect(classifyResource('Capstone Project Guide', 'reference')).toEqual({
        label: 'Project Reference',
        tone: 'accent',
      });
      expect(classifyResource('PROJECT EXAMPLES', 'reference')).toEqual({
        label: 'Project Reference',
        tone: 'accent',
      });
    });

    it('classifies generic reference titles as Reference Sheet with neutral tone', () => {
      expect(classifyResource('Mental Model', 'reference')).toEqual({
        label: 'Reference Sheet',
        tone: 'neutral',
      });
      expect(classifyResource('Architecture & Decision Model', 'reference')).toEqual({
        label: 'Reference Sheet',
        tone: 'neutral',
      });
      // Default parameter check
      expect(classifyResource('Suggested Resources')).toEqual({
        label: 'Reference Sheet',
        tone: 'neutral',
      });
    });
  });

  describe('Plan resources (purpose = plan)', () => {
    it('classifies titles containing project as Project Plan with neutral tone', () => {
      expect(classifyResource('Project Milestones', 'plan')).toEqual({
        label: 'Project Plan',
        tone: 'neutral',
      });
      expect(classifyResource('FINAL PROJECT SCHEDULE', 'plan')).toEqual({
        label: 'Project Plan',
        tone: 'neutral',
      });
    });

    it('classifies generic plan titles as Planning Sheet with neutral tone', () => {
      expect(classifyResource('Hours & Schedule', 'plan')).toEqual({
        label: 'Planning Sheet',
        tone: 'neutral',
      });
      expect(classifyResource('Portfolio & Scenarios', 'plan')).toEqual({
        label: 'Planning Sheet',
        tone: 'neutral',
      });
    });

    it('preserves Course Reference for plan sheets if title indicates course material', () => {
      expect(classifyResource('Course Syllabus Tracker', 'plan')).toEqual({
        label: 'Course Reference',
        tone: 'accent',
      });
    });
  });
});
