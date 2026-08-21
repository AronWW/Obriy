import { AssignmentType } from '@prisma/client';
import { gradeCategorizationResponse } from '../../../src/assignments/grading/categorization-grading';
import { gradeFillBlanksResponse } from '../../../src/assignments/grading/fill-blanks-grading';
import { gradeImageHotspotResponse } from '../../../src/assignments/grading/image-hotspot-grading';
import { validateAssignmentPublishPayload } from '../../../src/assignments/validation';

describe('interactive assignment grading', () => {
  it('awards partial categorization credit per correctly placed item', () => {
    const categories = [id('a'), id('b')].map((value, index) => ({
      id: value,
      title: `Category ${index}`,
    }));
    const items = [id('c'), id('d'), id('e')].map((value, index) => ({
      id: value,
      text: `Item ${index}`,
    }));
    const assignments = items.map((item, index) => ({
      itemId: item.id,
      categoryId: categories[index % 2].id,
    }));
    expect(
      validateAssignmentPublishPayload(AssignmentType.CATEGORIZATION, 1, {
        publicConfig: { categories, items },
        gradingConfig: { assignments, scoringMode: 'PARTIAL' },
      }).success,
    ).toBe(true);
    expect(
      gradeCategorizationResponse({
        type: AssignmentType.CATEGORIZATION,
        publicConfig: { categories, items },
        gradingConfig: { assignments, scoringMode: 'PARTIAL' },
        responseData: {
          assignments: [
            assignments[0],
            assignments[1],
            { itemId: items[2].id, categoryId: categories[1].id },
          ],
        },
        maxPoints: 6,
      }),
    ).toEqual(
      expect.objectContaining({
        scorePoints: 4,
        scorePercent: 66.67,
        isCorrect: false,
      }),
    );
  });

  it('normalizes case and whitespace in fill-blank answers', () => {
    const blankA = id('a');
    const blankB = id('b');
    const publicConfig = {
      segments: [
        { id: id('c'), type: 'TEXT', text: 'The ' },
        { id: blankA, type: 'BLANK' },
        { id: id('d'), type: 'TEXT', text: ' Sea and ' },
        { id: blankB, type: 'BLANK' },
      ],
      wordBankEnabled: false,
      wordBank: [],
    };
    const gradingConfig = {
      blanks: [
        { blankId: blankA, acceptedAnswers: ['Black'] },
        { blankId: blankB, acceptedAnswers: ['Kyiv'] },
      ],
      scoringMode: 'PARTIAL',
    };
    expect(
      gradeFillBlanksResponse({
        type: AssignmentType.FILL_BLANKS,
        publicConfig,
        gradingConfig,
        responseData: {
          answers: [
            { blankId: blankA, text: '  BLACK ' },
            { blankId: blankB, text: 'Lviv' },
          ],
        },
        maxPoints: 8,
      }),
    ).toEqual(
      expect.objectContaining({
        scorePoints: 4,
        scorePercent: 50,
        isCorrect: false,
      }),
    );
  });

  it('grades a hotspot using a radius relative to the shorter image side', () => {
    const publicConfig = {
      promptImage: { attachmentId: id('a'), width: 1_000, height: 500 },
    };
    const gradingConfig = { target: { x: 0.5, y: 0.5, radius: 0.1 } };
    expect(
      gradeImageHotspotResponse({
        type: AssignmentType.IMAGE_HOTSPOT,
        publicConfig,
        gradingConfig,
        responseData: { x: 0.54, y: 0.5 },
        maxPoints: 5,
      }).isCorrect,
    ).toBe(true);
    expect(
      gradeImageHotspotResponse({
        type: AssignmentType.IMAGE_HOTSPOT,
        publicConfig,
        gradingConfig,
        responseData: { x: 0.56, y: 0.5 },
        maxPoints: 5,
      }).isCorrect,
    ).toBe(false);
  });
});

function id(letter: string): string {
  return `${letter.repeat(8)}-${letter.repeat(4)}-4${letter.repeat(3)}-8${letter.repeat(3)}-${letter.repeat(12)}`;
}
