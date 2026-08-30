import { describe, it, expect } from 'vitest';
import {
  buildAudiencesListArgs,
  buildAudiencesGetArgs,
  buildAudiencesUpsertArgs,
  buildAudiencesAnalyzeArgs,
} from './audiences.js';

describe('buildAudiencesListArgs', () => {
  it('omits all keys when no flags are passed', () => {
    expect(buildAudiencesListArgs({})).toEqual({});
  });

  it('maps flags with type uppercased and paging coerced', () => {
    expect(buildAudiencesListArgs({
      search: 'Q3 outbound',
      type: 'contact',
      createdBy: 'Jane Doe',
      page: '2',
      pageSize: '25',
    })).toEqual({
      searchText: 'Q3 outbound',
      type: 'CONTACT',
      createdByName: 'Jane Doe',
      pageNumber: 2,
      pageSize: 25,
    });
  });
});

describe('buildAudiencesGetArgs', () => {
  it('fetches metadata only by default', () => {
    expect(buildAudiencesGetArgs({ id: 'aud-1' })).toEqual({ audienceId: 'aud-1' });
  });

  it('bare --preview enables previewRows without a limit', () => {
    expect(buildAudiencesGetArgs({ id: 'aud-1', preview: true })).toEqual({
      audienceId: 'aud-1',
      previewRows: true,
    });
  });

  it('--preview with a value sets previewRowLimit and forwards columns + filter', () => {
    expect(buildAudiencesGetArgs({
      id: 'aud-1',
      preview: '10',
      previewColumns: ['col-a', 'col-b'],
      rowFilter: '{"operator":"AND","filters":[]}',
    })).toEqual({
      audienceId: 'aud-1',
      previewRows: true,
      previewRowLimit: 10,
      previewColumnIds: ['col-a', 'col-b'],
      rowFilter: { operator: 'AND', filters: [] },
    });
  });
});

describe('buildAudiencesUpsertArgs', () => {
  it('builds a create payload (no audienceId) with type uppercased', () => {
    expect(buildAudiencesUpsertArgs({
      name: 'Q3 targets',
      type: 'company',
      instruction: 'Create an audience of Q3 target accounts.',
      searchQuery: '{"metroRegion":"MA - Boston"}',
    })).toEqual({
      agentInstruction: 'Create an audience of Q3 target accounts.',
      name: 'Q3 targets',
      type: 'COMPANY',
      searchQuery: '{"metroRegion":"MA - Boston"}',
    });
  });

  it('builds an update payload keyed by audienceId, preserving omitted fields', () => {
    expect(buildAudiencesUpsertArgs({
      id: 'aud-1',
      instruction: 'Rename the audience.',
      name: 'Q4 targets',
    })).toEqual({
      agentInstruction: 'Rename the audience.',
      audienceId: 'aud-1',
      name: 'Q4 targets',
    });
  });
});

describe('buildAudiencesAnalyzeArgs', () => {
  it('uses the audience id for both entityId and workbookSheetId', () => {
    expect(buildAudiencesAnalyzeArgs({ id: 'aud-1', query: 'Top industries?' })).toEqual({
      query: 'Top industries?',
      agentProps: { entityId: 'aud-1', workbookSheetId: 'aud-1' },
    });
  });

  it('forwards a view id when provided', () => {
    expect(buildAudiencesAnalyzeArgs({ id: 'aud-1', query: 'Summarize', viewId: 'view-9' })).toEqual({
      query: 'Summarize',
      agentProps: { entityId: 'aud-1', workbookSheetId: 'aud-1', view_id: 'view-9' },
    });
  });
});
