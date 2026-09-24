import { describe, it, expect } from 'vitest';
import {
  buildAudiencesListArgs,
  buildAudiencesGetArgs,
  buildAudiencesUpsertArgs,
  buildAudiencesRowsArgs,
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

  it('strips pagination and sort keys from --search-query', () => {
    const args = buildAudiencesUpsertArgs({
      name: 'SF VPs',
      type: 'contact',
      instruction: 'Create an audience of VPs in San Francisco.',
      searchQuery: '{"managementLevelList":["VP Level Exec"],"metroRegion":"CA - San Francisco","page":1,"pageSize":25,"sort":"-relevance"}',
    });
    expect(JSON.parse(args.searchQuery as string)).toEqual({
      managementLevelList: ['VP Level Exec'],
      metroRegion: 'CA - San Francisco',
    });
  });

  it('rejects --search-query that is not a JSON object', () => {
    const base = { name: 'x', type: 'COMPANY', instruction: 'Create an audience.' };
    expect(() => buildAudiencesUpsertArgs({ ...base, searchQuery: 'metroRegion=Boston' })).toThrow(/valid JSON/);
    expect(() => buildAudiencesUpsertArgs({ ...base, searchQuery: '["Boston"]' })).toThrow(/JSON object/);
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

describe('buildAudiencesRowsArgs', () => {
  const row = { values: [{ columnId: 'col-a', value: 'Acme' }] };

  it('builds the manage_audience_rows payload', () => {
    expect(buildAudiencesRowsArgs('aud-1', [row], 'Load these leads.')).toEqual({
      audienceId: 'aud-1',
      rows: [row],
      agentInstruction: 'Load these leads.',
    });
  });

  it('accepts up to 50 rows', () => {
    expect(() => buildAudiencesRowsArgs('aud-1', Array(50).fill(row), 'Load.')).not.toThrow();
  });

  it('rejects empty files and more than 50 rows', () => {
    expect(() => buildAudiencesRowsArgs('aud-1', [], 'Load.')).toThrow(/1-50 rows/);
    expect(() => buildAudiencesRowsArgs('aud-1', Array(51).fill(row), 'Load.')).toThrow(/1-50 rows/);
  });
});

describe('buildAudiencesAnalyzeArgs', () => {
  it('passes the audience id and query at the top level', () => {
    expect(buildAudiencesAnalyzeArgs({ id: 'aud-1', query: 'Top industries?' })).toEqual({
      audienceId: 'aud-1',
      query: 'Top industries?',
    });
  });
});
