import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiCall = vi.fn();
vi.mock('../api.js', async (importOriginal) => ({ ...(await importOriginal<object>()), apiCall }));

const { buildExecuteBody, waitForExecution } = await import('./exports.js');

const execution = (status: string) => ({ data: { id: 'run-1', attributes: { exportId: 'exp-1', status } } });

beforeEach(() => {
  apiCall.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('buildExecuteBody', () => {
  it('sends company or contact IDs as integers with their object type', () => {
    expect(buildExecuteBody({ companyIds: ['344589814,123'] })).toEqual({
      data: { type: 'ExecuteExportRequest', attributes: { objectType: 'COMPANY', ids: [344589814, 123] } },
    });
    expect(buildExecuteBody({ contactIds: ['-2032531906'] })).toMatchObject({
      data: { attributes: { objectType: 'CONTACT', ids: [-2032531906] } },
    });
  });

  it('requires exactly one kind of ID', () => {
    expect(() => buildExecuteBody({})).toThrow(/exactly one/);
    expect(() => buildExecuteBody({ companyIds: ['1'], contactIds: ['2'] })).toThrow(/exactly one/);
    expect(() => buildExecuteBody({ companyIds: ['acme.com'] })).toThrow(/--company-ids must be an integer/);
  });
});

describe('waitForExecution', () => {
  it('polls until the run reaches a final status', async () => {
    apiCall.mockResolvedValueOnce(execution('IN_PROGRESS')).mockResolvedValueOnce(execution('COMPLETED'));
    const done = await waitForExecution(execution('PENDING'), 0);
    expect(done.data.attributes.status).toBe('COMPLETED');
    expect(apiCall).toHaveBeenCalledTimes(2);
    expect(apiCall).toHaveBeenCalledWith('/platform/v1/exports/executions/run-1');
  });

  it('returns immediately for a run that has already finished', async () => {
    await waitForExecution(execution('FAILED'), 0);
    expect(apiCall).not.toHaveBeenCalled();
  });
});
